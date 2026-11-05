import type { WebSocket } from 'ws'
import type { Message, Sender, WsFrame } from '../types.ts'
import { visibleTo } from '../lib/store.ts'

const WS_OPEN = 1

/** Registo das ligações WebSocket ativas + broadcast a todas. */
export class WsHub {
  private readonly sockets = new Set<WebSocket>()
  private readonly peers = new Map<WebSocket, Sender>()

  get size(): number {
    return this.sockets.size
  }

  add(socket: WebSocket): void {
    this.sockets.add(socket)
  }

  remove(socket: WebSocket): void {
    this.sockets.delete(socket)
    if (this.peers.delete(socket)) this.broadcastPresence()
  }

  /** Dispositivos ligados, um por id (o mesmo telemóvel pode ter vários separadores). */
  presence(): Sender[] {
    const byId = new Map<string, Sender>()
    for (const peer of this.peers.values()) byId.set(peer.id, peer)
    return [...byId.values()]
  }

  /** Nome atual de um dispositivo ligado (para guardar com os destinatários). */
  readonly nameOf = (id: string): string | undefined => {
    for (const peer of this.peers.values()) if (peer.id === id) return peer.name
    return undefined
  }

  identify(socket: WebSocket, peer: Sender): void {
    if (!this.sockets.has(socket)) return
    this.peers.set(socket, peer)
    this.broadcastPresence()
  }

  broadcastPresence(): void {
    this.broadcast({ t: 'presence', peers: this.presence() })
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

  /** Mensagem nova: privadas só seguem para o remetente e os destinatários ligados. */
  broadcastMessage(message: Message): void {
    if (!message.to) {
      this.broadcast({ t: 'message', message })
      return
    }
    const payload = JSON.stringify({ t: 'message', message } satisfies WsFrame)
    for (const socket of this.sockets) {
      if (socket.readyState !== WS_OPEN || !visibleTo(message, this.peers.get(socket)?.id)) continue
      try {
        socket.send(payload)
      } catch {
        this.remove(socket)
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