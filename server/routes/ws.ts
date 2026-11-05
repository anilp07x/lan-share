import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { WebSocket } from 'ws'
import type { Store } from '../lib/store.ts'
import type { WsHub } from '../ws/hub.ts'
import type { WsFrame } from '../types.ts'
import { sanitizeSender } from '../lib/sanitize.ts'

export interface WsDeps {
  store: Store
  hub: WsHub
  historyLimit: number
}

export const WS_PING_INTERVAL_MS = 30_000

export async function wsRoutes(app: FastifyInstance, deps: WsDeps): Promise<void> {
  const { store, hub, historyLimit } = deps

  // A autenticação já é exigida pelo hook preHandler global (rota /ws).
  app.get('/ws', { websocket: true }, (socket: WebSocket, req: FastifyRequest) => {
    hub.add(socket)

    // A identidade vem logo no URL (/ws?id=…&name=…): o histórico já inclui
    // os envios privados deste dispositivo.
    const query = req.query as { id?: unknown; name?: unknown }
    const viewer = sanitizeSender(query.id, query.name)
    const frame: WsFrame = { t: 'history', messages: store.recentMessages(historyLimit, viewer?.id) }
    if (socket.readyState === 1) {
      try {
        socket.send(JSON.stringify(frame))
        if (viewer) hub.identify(socket, viewer)
        else socket.send(JSON.stringify({ t: 'presence', peers: hub.presence() } satisfies WsFrame))
      } catch {
        /* o close trata da remoção */
      }
    }

    // Única mensagem do cliente: {t:'hello', id, name} para a lista de presença.
    socket.on('message', (raw: Buffer) => {
      let data: unknown
      try {
        data = JSON.parse(raw.toString('utf8'))
      } catch {
        return
      }
      if (typeof data !== 'object' || data === null) return
      const hello = data as { t?: unknown; id?: unknown; name?: unknown }
      if (hello.t !== 'hello') return
      const peer = sanitizeSender(hello.id, hello.name)
      if (peer) hub.identify(socket, peer)
    })
    socket.on('error', () => socket.terminate())

    const pingTimer = setInterval(() => {
      if (socket.readyState !== 1) {
        socket.terminate()
        return
      }
      try {
        socket.ping()
      } catch {
        socket.terminate()
      }
    }, WS_PING_INTERVAL_MS)
    pingTimer.unref()

    socket.on('close', () => {
      clearInterval(pingTimer)
      hub.remove(socket)
    })
  })
}