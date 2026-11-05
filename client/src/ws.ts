import type { Sender, WsFrame } from './types.ts'

export type WsStatus = 'connecting' | 'open' | 'reconnecting'

const BASE_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 15_000
const JITTER_MS = 500

/** WebSocket com reconexão automática (backoff exponencial + jitter). */
export class WsClient {
  private ws: WebSocket | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private backoff = BASE_BACKOFF_MS
  private stopped = true

  status: WsStatus = 'connecting'
  onStatus: ((s: WsStatus) => void) | null = null
  onFrame: ((f: WsFrame) => void) | null = null
  /** Identidade anunciada ao servidor (lista de presença). */
  identity: Sender | null = null

  start(): void {
    this.stopped = false
    this.connect()
  }

  stop(): void {
    this.stopped = true
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.ws !== null) {
      const ws = this.ws
      this.ws = null
      ws.onclose = null
      ws.onerror = null
      ws.close()
    }
  }

  private connect(): void {
    if (this.stopped) return
    this.setStatus('connecting')
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
    // a identidade vai no URL para o histórico já incluir os envios privados
    const id = this.identity
    const query = id ? `?id=${encodeURIComponent(id.id)}&name=${encodeURIComponent(id.name)}` : ''
    const ws = new WebSocket(`${protocol}://${location.host}/ws${query}`)
    this.ws = ws

    ws.onopen = () => {
      this.backoff = BASE_BACKOFF_MS
      this.setStatus('open')
      this.hello()
    }
    ws.onmessage = (ev: MessageEvent) => {
      try {
        this.onFrame?.(JSON.parse(String(ev.data)) as WsFrame)
      } catch {
        /* frame inválido: ignora */
      }
    }
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null
      if (this.stopped) return
      this.scheduleReconnect()
    }
    ws.onerror = () => {
      ws.close()
    }
  }

  /** Anuncia (ou volta a anunciar, após mudar de nome) este dispositivo. */
  hello(identity: Sender | null = this.identity): void {
    this.identity = identity
    if (!identity || this.ws?.readyState !== WebSocket.OPEN) return
    try {
      this.ws.send(JSON.stringify({ t: 'hello', id: identity.id, name: identity.name }))
    } catch {
      /* o reconnect volta a anunciar */
    }
  }

  private scheduleReconnect(): void {
    this.setStatus('reconnecting')
    const delay = this.backoff + Math.random() * JITTER_MS
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS)
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      this.connect()
    }, delay)
  }

  private setStatus(s: WsStatus): void {
    this.status = s
    this.onStatus?.(s)
  }
}