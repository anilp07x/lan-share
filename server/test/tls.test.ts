import { test } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fsp } from 'node:fs'
import crypto from 'node:crypto'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { ensureTls } from '../lib/tls.ts'
import { buildApp } from '../app.ts'
import type { Config } from '../config.ts'

async function tmpDir(): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'lanshare-tls-'))
}

test('tls: CA assina o certificado do servidor com o nome .local e os IPs', async (t) => {
  const dir = await tmpDir()
  t.after(() => fsp.rm(dir, { recursive: true, force: true }))

  const tls = await ensureTls(dir, 'lanshare.local', ['192.168.1.20'])
  const ca = new crypto.X509Certificate(tls.caCert)
  const leaf = new crypto.X509Certificate(tls.cert)
  assert.ok(ca.ca, 'a CA é uma autoridade')
  assert.ok(leaf.checkIssued(ca) && leaf.verify(ca.publicKey), 'servidor assinado pela CA')
  assert.match(leaf.subjectAltName ?? '', /DNS:lanshare\.local/)
  assert.match(leaf.subjectAltName ?? '', /IP Address:192\.168\.1\.20/)
  const days = (Date.parse(leaf.validTo) - Date.now()) / 86_400_000
  assert.ok(days <= 398, 'validade aceite pelo iOS')

  // mesmos IPs: reutiliza; IP novo: novo certificado, mesma CA
  const again = await ensureTls(dir, 'lanshare.local', ['192.168.1.20'])
  assert.equal(again.cert, tls.cert)
  const moved = await ensureTls(dir, 'lanshare.local', ['10.0.0.7'])
  assert.notEqual(moved.cert, tls.cert)
  assert.equal(moved.caCert, tls.caCert)
  assert.match(new crypto.X509Certificate(moved.cert).subjectAltName ?? '', /IP Address:10\.0\.0\.7/)
})

test('tls: a mesma app responde em HTTP e HTTPS e serve o /ca.crt', async (t) => {
  const dir = await tmpDir()
  t.after(() => fsp.rm(dir, { recursive: true, force: true }))
  const uploadDir = path.join(dir, 'files')
  await fsp.mkdir(path.join(uploadDir, 'tmp'), { recursive: true })
  const config: Config = {
    port: 0,
    host: '127.0.0.1',
    pin: null,
    maxFileBytes: 1024 * 1024,
    retentionMs: 0,
    uploadDir,
    tmpDir: path.join(uploadDir, 'tmp'),
    indexFile: path.join(dir, 'index.json'),
    minFreeDiskBytes: 0,
    maxTextLen: 1000,
    historyLimit: 50,
    sessionTtlMs: 60_000,
    previewMaxBytes: 1024 * 1024,
    sweepIntervalMs: 60_000,
    httpsPort: 1,
    mdnsHost: 'lanshare.local',
    tlsDir: path.join(dir, 'tls'),
  }
  const tls = await ensureTls(config.tlsDir, config.mdnsHost, [])
  const built = await buildApp({ config, pin: '123456', tls })
  t.after(() => built.app.close())
  await built.app.listen({ port: 0, host: '127.0.0.1' })
  const plain = built.plainServer
  assert.ok(plain, 'há servidor HTTP em paralelo')
  await new Promise<void>((resolve) => plain.listen(0, '127.0.0.1', () => resolve()))

  const httpPort = (plain.address() as AddressInfo).port
  const httpsPort = (built.app.server.address() as AddressInfo).port

  const caRes = await fetch(`http://127.0.0.1:${httpPort}/ca.crt`)
  assert.equal(caRes.status, 200)
  assert.equal(await caRes.text(), tls.caCert)

  // HTTPS validado contra a CA própria (como um telemóvel com o certificado instalado)
  const body = await new Promise<string>((resolve, reject) => {
    https
      .get({ host: '127.0.0.1', port: httpsPort, path: '/api/health', ca: tls.caCert, servername: 'localhost' }, (res) => {
        let data = ''
        res.on('data', (c: Buffer) => (data += c.toString()))
        res.on('end', () => resolve(data))
      })
      .on('error', reject)
  })
  assert.equal((JSON.parse(body) as { ok: boolean }).ok, true)
})
