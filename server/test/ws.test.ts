import { test } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { AddressInfo } from 'node:net'
import { buildApp } from '../app.ts'
import type { WsFrame } from '../types.ts'
import type { Config } from '../config.ts'

const SESSION_COOKIE = 'lan_share_session'

async function makeConfig(): Promise<{ config: Config; dir: string }> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'lanshare-ws-'))
  const uploadDir = path.join(dir, 'files')
  const config: Config = {
    port: 0,
    host: '127.0.0.1',
    pin: null,
    maxFileBytes: 10 * 1024 * 1024,
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
  }
  return { config, dir }
}

interface TestServer {
  base: string
  cookie: string
  hub: Awaited<ReturnType<typeof buildApp>>['hub']
  close: () => Promise<void>
}

async function startServer(): Promise<TestServer> {
  const { config, dir } = await makeConfig()
  await fsp.mkdir(config.tmpDir, { recursive: true })
  const built = await buildApp({ config, pin: '123456' })
  await built.app.listen({ port: 0, host: '127.0.0.1' })
  const port = (built.app.server.address() as AddressInfo).port
  const base = `http://127.0.0.1:${port}`

  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '123456' }),
  })
  assert.equal(login.status, 200, 'login deve funcionar no teste')
  const raw = login.headers.get('set-cookie') ?? ''
  const cookie = raw.split(';')[0] ?? ''
  assert.ok(cookie.startsWith(`${SESSION_COOKIE}=`), 'cookie de sessão presente')

  return {
    base,
    cookie,
    hub: built.hub,
    close: async () => {
      for (const socket of built.app.websocketServer.clients) socket.close()
      await built.app.close()
      await fsp.rm(dir, { recursive: true, force: true })
    },
  }
}

interface OpenWs {
  ws: WebSocket
  /** Espera por um frame; vê também frames que chegaram antes do open. */
  wait: (pred: (f: WsFrame) => boolean, timeoutMs?: number) => Promise<WsFrame>
}

function openWs(srv: TestServer, cookie?: string): Promise<OpenWs> {
  const url = srv.base.replace('http', 'ws') + '/ws'
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: cookie ? [['cookie', cookie]] : undefined,
    })
    const buffered: WsFrame[] = []
    const waiters: Array<{
      pred: (f: WsFrame) => boolean
      resolve: (f: WsFrame) => void
      reject: (e: Error) => void
      timer: NodeJS.Timeout
    }> = []

    ws.addEventListener('message', (ev: MessageEvent) => {
      const frame = JSON.parse(String(ev.data)) as WsFrame
      buffered.push(frame)
      for (const w of waiters) {
        if (w.pred(frame)) {
          clearTimeout(w.timer)
          w.resolve(frame)
        }
      }
    })

    const wait = (pred: (f: WsFrame) => boolean, timeoutMs = 2000): Promise<WsFrame> => {
      const existing = buffered.find(pred)
      if (existing) return Promise.resolve(existing)
      return new Promise<WsFrame>((resolve, reject) => {
        const waiter = {
          pred,
          resolve,
          reject,
          timer: setTimeout(() => reject(new Error('timeout à espera de frame WS')), timeoutMs),
        }
        waiters.push(waiter)
      })
    }

    const timer = setTimeout(() => {
      reject(new Error('timeout a abrir websocket'))
      ws.close()
    }, 3000)
    ws.addEventListener('open', () => {
      clearTimeout(timer)
      resolve({ ws, wait })
    })
    ws.addEventListener('error', () => {
      clearTimeout(timer)
      reject(new Error('websocket falhou (erro no handshake)'))
    })
  })
}

function waitClose(ws: WebSocket, timeoutMs = 2000): Promise<{ code: number }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout à espera de close WS')), timeoutMs)
    ws.addEventListener('close', (ev: CloseEvent) => {
      clearTimeout(timer)
      resolve({ code: ev.code })
    })
  })
}

async function postText(srv: TestServer, body: string): Promise<number> {
  const r = await fetch(`${srv.base}/api/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: srv.cookie },
    body: JSON.stringify({ body }),
  })
  return r.status
}

test('ws: com cookie recebe histórico e depois nova mensagem em tempo real', async (t) => {
  const srv = await startServer()
  t.after(() => srv.close())

  assert.equal(await postText(srv, 'antes do ws'), 201)

  const { ws, wait } = await openWs(srv, srv.cookie)
  t.after(() => ws.close())

  const history = await wait((f) => f.t === 'history')
  assert.equal(history.t, 'history')
  if (history.t === 'history') {
    assert.equal(history.messages.length, 1)
    const first = history.messages[0]
    assert.ok(first, 'deve haver uma mensagem no histórico')
    if (first?.kind === 'text') assert.equal(first.body, 'antes do ws')
  }

  assert.equal(await postText(srv, 'enquanto ligado'), 201)
  const live = await wait((f) => f.t === 'message')
  if (live.t === 'message' && live.message.kind === 'text') {
    assert.equal(live.message.body, 'enquanto ligado')
  }
})

test('ws: broadcast chega a dois dispositivos (duas ligações)', async (t) => {
  const srv = await startServer()
  t.after(() => srv.close())

  const a = await openWs(srv, srv.cookie)
  const b = await openWs(srv, srv.cookie)
  t.after(() => a.ws.close())
  t.after(() => b.ws.close())

  const gotA = a.wait((f) => f.t === 'message')
  const gotB = b.wait((f) => f.t === 'message')
  assert.equal(await postText(srv, 'para todos'), 201)
  const [fa, fb] = await Promise.all([gotA, gotB])
  assert.equal((fa as Extract<WsFrame, { t: 'message' }>).message.id, (fb as Extract<WsFrame, { t: 'message' }>).message.id)
})

test('ws: sem cookie o handshake falha (não abre)', async () => {
  const srv = await startServer()
  try {
    const outcome = await new Promise<'open' | 'error' | 'timeout'>((resolve) => {
      let settled = false
      const finish = (value: 'open' | 'error' | 'timeout') => {
        if (!settled) {
          settled = true
          resolve(value)
        }
      }
      const ws = new WebSocket(srv.base.replace('http', 'ws') + '/ws')
      ws.addEventListener('open', () => {
        finish('open')
        ws.close()
      })
      ws.addEventListener('error', () => finish('error'))
      setTimeout(() => finish('timeout'), 3000)
    })
    assert.equal(outcome, 'error', `esperava falha no handshake, obtive ${outcome}`)
  } finally {
    await srv.close()
  }
})

test('ws: maxPayload pequeno fecha ligação com frames grandes', async (t) => {
  const srv = await startServer()
  t.after(() => srv.close())

  const { ws } = await openWs(srv, srv.cookie)
  t.after(() => ws.close())

  const closed = waitClose(ws)
  ws.send('x'.repeat(2048))
  const { code } = await closed
  assert.ok([1006, 1009].includes(code), `close com código de erro (vi ${code})`)
})

test('ws: broadcastFileExpired chega as ligações', async (t) => {
  const srv = await startServer()
  t.after(() => srv.close())

  const { ws, wait } = await openWs(srv, srv.cookie)
  t.after(() => ws.close())

  const received = wait((f) => f.t === 'file-expired')
  srv.hub.broadcastFileExpired('file-que-expirou')
  const frame = await received
  if (frame.t === 'file-expired') assert.equal(frame.fileId, 'file-que-expirou')
})