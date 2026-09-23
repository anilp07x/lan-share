import type { WebSocket } from 'ws'
import type { WsFrame } from '../types.ts'

const WS_OPEN = 1

/** Registo das ligações WebSocket ativas + broadcast a todas. */
export class WsHub {
  private readonly sockets = new Set<WebSocket>()

  get size(): number {
    return this.sockets.size
  }

  add(socket: WebSocket): void {
    this.sockets.add(socket)
  }

  remove(socket: WebSocket): void {
    this.sockets.delete(socket)
  }

  broadcast(frame: WsFrame): void {
    const payload = JSON.stringify(frame)
    for (const socket of this.sockets) {
      if (socket.readyState === WS_OPEN) {
        try {
          socket.send(payload)
        } catch {
          this.remove(socket)
        }
      }
    }
  }

  broadcastFileExpired(fileId: string): void {
    this.broadcast({ t: 'file-expired', fileId })
  }

  /** Fecha todas as ligações com código e motivo (usado no shutdown). */
  closeAll(code: number, reason: string): void {
    for (const socket of this.sockets) {
      try {
        socket.close(code, reason)
      } catch {
        socket.terminate()
      }
    }
  }
}