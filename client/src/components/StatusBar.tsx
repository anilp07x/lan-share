import Icon from './Icon.tsx'
import type { Sender } from '../types.ts'
import type { WsStatus } from '../ws.ts'
import { useDevice } from '../lib/device.ts'
import { setAlertsEnabled, systemAlertsSupported, useAlertsEnabled } from '../lib/alerts.ts'
import { toast } from '../lib/toast.tsx'
import { cn } from '../lib/utils.ts'
import StationList from './StationList.tsx'

interface StatusBarProps {
  wsStatus: WsStatus
  peers: Sender[]
  onLogout: () => void
  onRename: () => void
  onConnect: () => void
  /** Página em HTTP com HTTPS disponível: o sino leva ao guia. */
  onSecureSetup?: () => void
}

function statusLabel(wsStatus: WsStatus): string {
  if (wsStatus === 'open') return 'Ligado'
  if (wsStatus === 'connecting') return 'A ligar…'
  return 'A reconectar…'
}

function StatusDot({ wsStatus }: { wsStatus: WsStatus }) {
  const connected = wsStatus === 'open'
  return (
    <span
      className={cn('size-2 shrink-0 rounded-full', connected ? 'bg-success animate-pulse-dot' : 'bg-warning')}
      aria-hidden="true"
    />
  )
}

function Brand({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          'bg-primary text-primary-foreground flex shrink-0 items-center justify-center rounded-xl',
          size === 'lg' ? 'size-10' : 'size-9',
        )}
      >
        <Icon name="capsule" className={size === 'lg' ? 'size-5' : 'size-[18px]'} />
      </div>
      <span className={cn('display', size === 'lg' ? 'text-[26px]' : 'text-[22px]')}>LAN Share</span>
    </div>
  )
}

function AlertsToggle({ className, onSecureSetup }: { className: string; onSecureSetup?: () => void }) {
  const on = useAlertsEnabled()
  const label = systemAlertsSupported ? 'Som e avisos de chegada' : 'Som de chegada'
  return (
    <button
      type="button"
      onClick={() => {
        void setAlertsEnabled(!on).then(() => {
          toast.info(on ? 'Avisos desligados' : `${label} ligados`)
          // sem HTTPS só há som; o guia mostra como ter avisos do sistema
          if (!on && !systemAlertsSupported) onSecureSetup?.()
        })
      }}
      className={className}
      aria-pressed={on}
      aria-label={label}
      title={`${label}: ${on ? 'ligados' : 'desligados'}`}
    >
      <Icon name={on ? 'bell' : 'bell-off'} className={cn('size-[18px]', !on && 'text-shell-muted')} />
    </button>
  )
}

/** Casco esmalte: cabeçalho no telemóvel, rail no desktop. */
export default function StatusBar({ wsStatus, peers, onLogout, onRename, onConnect, onSecureSetup }: StatusBarProps) {
  const device = useDevice()
  const label = statusLabel(wsStatus)
  const shellButton =
    'text-shell-foreground hover:bg-shell-raised focus-visible:outline-primary flex items-center justify-center rounded-xl transition-colors'

  return (
    <>
      {/* cabeçalho — telemóvel */}
      <header className="bg-shell text-shell-foreground sticky top-0 z-40 flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 md:hidden">
        <Brand />
        <div className="flex-1" />
        <button
          type="button"
          onClick={onConnect}
          className="border-shell-line hover:bg-shell-raised flex h-11 items-center gap-2 rounded-full border px-3 transition-colors"
          aria-label={`${label}. ${peers.length} ${peers.length === 1 ? 'estação ligada' : 'estações ligadas'}. Ligar outro dispositivo`}
        >
          <StatusDot wsStatus={wsStatus} />
          <span className="tag text-sm tabular-nums">{peers.length}</span>
          <Icon name="qr" className="size-4" />
        </button>
        <AlertsToggle className={cn(shellButton, 'size-11')} onSecureSetup={onSecureSetup} />
        <button type="button" onClick={onLogout} className={cn(shellButton, 'size-11')} aria-label="Sair">
          <Icon name="logout" className="size-[18px]" />
        </button>
      </header>

      {/* rail — desktop */}
      <aside className="bg-shell text-shell-foreground hidden w-72 shrink-0 flex-col md:flex">
        <div className="px-5 pt-6 pb-5">
          <Brand size="lg" />
          <p className="text-shell-muted mt-3 flex items-center gap-2 text-sm" role="status">
            <StatusDot wsStatus={wsStatus} />
            {label} · rede local
          </p>
        </div>

        <div className="mx-5 border-t border-shell-line" />

        <section className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-5" aria-labelledby="stations-heading">
          <h2 id="stations-heading" className="tag text-shell-muted text-xs">
            Estações ligadas · {peers.length}
          </h2>
          <div className="feed-scroll -mx-1 min-h-0 px-1">
            <StationList peers={peers} selfId={device.id} tone="shell" />
          </div>
          <button
            type="button"
            onClick={onConnect}
            className="bg-shell-raised hover:bg-shell-line mt-1 flex h-11 items-center gap-2.5 rounded-xl px-3.5 text-sm font-medium transition-colors"
          >
            <Icon name="qr" className="size-4" />
            Ligar outro dispositivo
          </button>
        </section>

        <div className="border-shell-line flex items-center gap-1 border-t p-3">
          <button
            type="button"
            onClick={onRename}
            className="hover:bg-shell-raised flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors"
            aria-label={`Este dispositivo: ${device.name}. Mudar nome`}
          >
            <span className="bg-primary size-2.5 shrink-0 rounded-full" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="tag text-shell-muted block text-[11px]">Este dispositivo</span>
              <span className="block truncate text-sm font-medium">{device.name}</span>
            </span>
            <Icon name="pencil" className="text-shell-muted size-3.5 shrink-0" />
          </button>
          <AlertsToggle className={cn(shellButton, 'size-11')} onSecureSetup={onSecureSetup} />
          <button type="button" onClick={onLogout} className={cn(shellButton, 'size-11')} aria-label="Sair" title="Sair">
            <Icon name="logout" className="size-[18px]" />
          </button>
        </div>
      </aside>
    </>
  )
}
