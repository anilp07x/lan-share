import type { FastifyInstance } from 'fastify'
import type { WebSocket } from 'ws'
import type { Store } from '../lib/store.ts'
import type { WsHub } from '../ws/hub.ts'
import type { WsFrame } from '../types.ts'

export interface WsDeps {
  store: Store
  hub: WsHub
  historyLimit: number
}

export const WS_PING_INTERVAL_MS = 30_000

export async function wsRoutes(app: FastifyInstance, deps: WsDeps): Promise<void> {
  const { store, hub, historyLimit } = deps

  // A autenticação já é exigida pelo hook preHandler global (rota /ws).
  app.get('/ws', { websocket: true }, (socket: WebSocket) => {
    hub.add(socket)

    const frame: WsFrame = { t: 'history', messages: store.recentMessages(historyLimit) }
    if (socket.readyState === 1) {
      try {
        socket.send(JSON.stringify(frame))
      } catch {
        /* o close trata da remoção */
      }
    }

    // O cliente não envia dados para o servidor; ignoramos.
    socket.on('message', () => {})
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