import crypto from 'node:crypto'

export interface Session {
  createdAt: number
  lastSeen: number
}

/** Sessões em memória (LAN, um servidor). Reiniciar = voltar a introduzir o PIN. */
export class SessionStore {
  private readonly sessions = new Map<string, Session>()
  private readonly ttlMs: number

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs
  }

  create(): { token: string; session: Session } {
    const token = crypto.randomBytes(32).toString('hex')
    const session: Session = { createdAt: Date.now(), lastSeen: Date.now() }
    this.sessions.set(token, session)
    return { token, session }
  }

  /** Devolve a sessão se existir e não estiver expirada; renova `lastSeen`. */
  get(token: string): Session | null {
    const session = this.sessions.get(token)
    if (!session) return null
    const now = Date.now()
    if (now - session.createdAt > this.ttlMs) {
      this.sessions.delete(token)
      return null
    }
    session.lastSeen = now
    return session
  }

  delete(token: string): void {
    this.sessions.delete(token)
  }

  /** Remove sessões expiradas. Chama a cada poucos minutos. */
  prune(): void {
    const now = Date.now()
    for (const [token, session] of this.sessions) {
      if (now - session.createdAt > this.ttlMs) this.sessions.delete(token)
    }
  }
}