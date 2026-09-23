import { spawn } from 'node:child_process'
import { createReadStream, createWriteStream, readFileSync } from 'node:fs'
import { readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import crypto from 'node:crypto'
import { ReadableStream } from 'node:stream/web'

const ROOT = import.meta.dirname + '/..'
const TMP = process.env.TEMP || '/tmp'
const DIRS = {
  data: join(TMP, 'lanshare-stress-data'),
  files: join(TMP, 'lanshare-stress-files'),
}

const results = []
function ok(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

async function waitHealth(base, timeoutMs = 30000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`${base}/api/health`)
      if (r.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('health não respondeu')
}

function md5File(p) {
  return new Promise((res, rej) => {
    const h = crypto.createHash('md5')
    const s = createReadStream(p)
    s.on('error', rej)
    s.on('data', (d) => h.update(d))
    s.on('end', () => res(h.digest('hex')))
  })
}

// Upload com streaming multipart manual (sem bufferizar o ficheiro em RAM).
async function uploadStream(path, filename, base, cookie) {
  const BOUNDARY = '----lanshare-stress'
  const size = (await stat(path)).size
  const head = Buffer.from(
    `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
    'latin1',
  )
  const foot = Buffer.from(`\r\n--${BOUNDARY}--\r\n`, 'latin1')
  const fileStream = createReadStream(path)
  const body = new ReadableStream({
    async start(controller) {
      controller.enqueue(head)
      for await (const chunk of fileStream) controller.enqueue(chunk)
      fileStream.destroy()
      controller.enqueue(foot)
      controller.close()
    },
  })
  const res = await fetch(`${base}/api/upload`, {
    method: 'POST',
    headers: {
      cookie,
      'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
      'content-length': String(head.length + size + foot.length),
    },
    body,
    duplex: 'half',
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

async function startServer(port, extraEnv) {
  const child = spawn(process.execPath, ['server/index.ts'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), UPLOAD_DIR: DIRS.data, PIN: '123456', ...extraEnv },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  await waitHealth(`http://localhost:${port}`)
  return { child, port, base: `http://localhost:${port}` }
}

async function login(base, pin) {
  const r = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
  return r.headers.get('set-cookie').split(';')[0]
}

async function phaseA() {
  console.log('\n── Fase A: uploads grandes/paralelos + flood de texto ──')
  await rm(DIRS.data, { recursive: true, force: true })
  await rm(DIRS.files, { recursive: true, force: true })
  await import('node:fs/promises').then((m) => m.mkdir(DIRS.files, { recursive: true }))
  const { child, base } = await startServer(4111)
  const pin = '123456'
  const cookie = await login(base, pin)

  const big = join(DIRS.files, 'grande.bin')
  const smallA = join(DIRS.files, 'a.bin')
  const smallB = join(DIRS.files, 'b.bin')
  for (const [p, mb] of [[big, 160], [smallA, 60], [smallB, 60]]) {
    await new Promise((res, rej) => {
      const w = createWriteStream(p)
      w.on('finish', res)
      w.on('error', rej)
      const chunk = Buffer.alloc(1024 * 1024, 'z')
      const total = mb * 1024 * 1024
      let written = 0
      const write = () => {
        while (written < total) {
          written += chunk.length
          if (!w.write(chunk)) {
            w.once('drain', write)
            return
          }
        }
        w.end()
      }
      write()
    })
  }

  const t0 = Date.now()
  const upBig = await uploadStream(big, 'grande 160 mib.bin', base, cookie)
  const bigMs = Date.now() - t0
  ok('upload 160 MiB (streaming)', upBig.status === 201, `${bigMs}ms status=${upBig.status}`)
  const bigId = upBig.json?.message?.file?.fileId

  const t1 = Date.now()
  const [ra, rb] = await Promise.all([
    uploadStream(smallA, 'a.bin', base, cookie),
    uploadStream(smallB, 'b.bin', base, cookie),
  ])
  ok('2 uploads paralelos', ra.status === 201 && rb.status === 201, `${Date.now() - t1}ms`)
  const raId = ra.json?.message?.file?.fileId
  const rbId = rb.json?.message?.file?.fileId

  const dl = await fetch(`${base}/api/files/${bigId}`, { headers: { cookie } })
  const buf = Buffer.from(await dl.arrayBuffer())
  const sum = crypto.createHash('md5').update(buf).digest('hex')
  const origSum = await md5File(big)
  ok(
    'download 160 MiB integro',
    dl.status === 200 && sum === origSum && buf.length === 160 * 1024 * 1024,
    `bytes=${buf.length} md5 ${sum === origSum ? 'bate' : 'difere'}`,
  )

  const names = await readdir(DIRS.data)
  ok(
    'nomes com espaço guardados por id no disco',
    names.includes(bigId) && names.includes(raId) && names.includes(rbId),
    `[${names.join(', ')}]`,
  )

  for (let i = 0; i < 120; i++) {
    await fetch(`${base}/api/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ body: `mensagem ${i}` }),
    })
  }
  const hist = await (await fetch(`${base}/api/history`, { headers: { cookie } })).json()
  const last = hist.messages[hist.messages.length - 1]?.body
  ok('flood 120 msgs -> histórico limitado a 50', hist.messages.length === 50 && last === 'mensagem 119', `len=${hist.messages.length}`)

  child.kill()
  await rm(DIRS.files, { recursive: true, force: true })
}

async function phaseB() {
  console.log('\n── Fase B: sweep de expirados + broadcast WS ──')
  await rm(DIRS.data, { recursive: true, force: true })
  await rm(DIRS.files, { recursive: true, force: true })
  await import('node:fs/promises').then((m) => m.mkdir(DIRS.files, { recursive: true }))
  const { child, base } = await startServer(4112, {
    RETENTION_HOURS: '0.00003',
    SWEEP_INTERVAL_MIN: '1',
  })
  const cookie = await login(base, '123456')

  const f = join(DIRS.files, 'exp.bin')
  await new Promise((res) => {
    const w = createWriteStream(f)
    for (let i = 0; i < 1024 * 512; i++) w.write(Buffer.from('x'))
    w.end(res)
  })
  const up = await uploadStream(f, 'exp.bin', base, cookie)
  ok('upload serve como expira logo', up.status === 201)
  const id = up.json?.message?.file?.fileId
  await new Promise((r) => setTimeout(r, 100))
  const dl = await fetch(`${base}/api/files/${id}`, { headers: { cookie } })
  const dlBuf = Buffer.from(await dl.arrayBuffer())
  const expSum = await md5File(f)
  const expDl = crypto.createHash('md5').update(dlBuf).digest('hex')
  ok('download imediato íntegro', dl.status === 200 && expDl === expSum && dlBuf.length === 1024 * 512)

  const events = []
  const ws = new WebSocket(`ws://localhost:4112/ws`, { headers: [['cookie', cookie]] })
  ws.addEventListener('message', (ev) => events.push(JSON.parse(ev.data)))

  const t0 = Date.now()
  let gone = false
  while (Date.now() - t0 < 90000) {
    const r = await fetch(`${base}/api/files/${id}`, { headers: { cookie } })
    if (r.status === 404) { gone = true; break }
    await new Promise((r2) => setTimeout(r2, 1000))
  }
  ok('sweep remove ficheiro expirado (404)', gone, `${Math.round((Date.now() - t0) / 1000)}s`)
  await new Promise((r) => setTimeout(r, 2000))
  const diskIds = await readdir(DIRS.data)
  ok(
    'broadcast WS file-expired recebido',
    events.some((e) => e.t === 'file-expired' && e.fileId === id),
    `eventos WS: ${events.map((e) => e.t).join(',')}`,
  )
  ok('ficheiro apagado do disco', !diskIds.includes(id), `disco: ${diskIds.join(',')}`)
  child.kill()
  await rm(DIRS.files, { recursive: true, force: true })
}

await phaseA()
await phaseB()
console.log('\nRESUMO:', results.filter((r) => r.pass).length + '/' + results.length, 'ok')
if (results.some((r) => !r.pass)) process.exit(1)