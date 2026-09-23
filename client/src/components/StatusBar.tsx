import type { WsStatus } from '../ws.ts'

interface StatusBarProps {
  wsStatus: WsStatus
  onLogout: () => void
}

export default function StatusBar({ wsStatus, onLogout }: StatusBarProps) {
  const label =
    wsStatus === 'open' ? 'Ligado' : wsStatus === 'connecting' ? 'A ligar…' : 'A reconectar…'
  const cls = wsStatus === 'open' ? 'ok' : wsStatus === 'connecting' ? 'connecting' : 'reconnecting'

  return (
    <header className="statusbar">
      <div className={`status-dot ${cls}`} aria-hidden="true" />
      <span className="status-label">{label}</span>
      <button type="button" className="btn btn-ghost btn-small" onClick={onLogout}>
        Sair
      </button>
    </header>
  )
}