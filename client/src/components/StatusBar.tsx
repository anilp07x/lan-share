import { useMemo, useState } from 'react'
import Icon, { type IconName } from './Icon.tsx'
import type { WsStatus } from '../ws.ts'
import { useCopied } from '../hooks/useCopied.ts'
import { usePwaInstall } from '../hooks/usePwaInstall.ts'
import { toast } from '../lib/toast.tsx'
import { cn } from '../lib/utils.ts'
import { formatBytes } from '../lib/format.ts'
import { prefersReducedMotion } from '../lib/motion.ts'
import { Badge } from './ui/badge.tsx'
import { Button } from './ui/button.tsx'
import { Separator } from './ui/separator.tsx'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.tsx'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
} from './ui/alert-dialog.tsx'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog.tsx'

interface SessionStats {
  messages: number
  files: number
  bytes: number
}

interface StatusBarProps {
  wsStatus: WsStatus
  stats: SessionStats
  onLogout: () => void
}

const STATUS_META: Record<WsStatus, { label: string; hint: string; dot: string; tone: 'success' | 'warning' | 'muted' }> = {
  open: {
    label: 'Ligado',
    hint: 'Ligação activa. Tudo o que enviares aparece aqui e nos outros dispositivos.',
    dot: 'bg-success text-success',
    tone: 'success',
  },
  connecting: {
    label: 'A ligar…',
    hint: 'A estabelecer a ligação ao servidor local.',
    dot: 'bg-warning text-warning',
    tone: 'warning',
  },
  reconnecting: {
    label: 'A reconectar…',
    hint: 'Ligação perdida. A app tenta voltar a ligar automaticamente.',
    dot: 'bg-warning text-warning',
    tone: 'warning',
  },
}

function ConnectDialog() {
  const { copied, copy } = useCopied()
  const url = typeof window !== 'undefined' ? window.location.href : ''
  const origin = url.replace(/\/+$/, '')

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="bg-primary/12 text-primary flex size-8 items-center justify-center rounded-lg">
            <Icon name="link" className="size-4" />
          </span>
          Ligar outros dispositivos
        </DialogTitle>
        <DialogDescription>
          Abre este endereço noutro telemóvel ou computador que esteja na mesma rede. Nada sai de casa.
        </DialogDescription>
      </DialogHeader>

      {/* endereço */}
      <div className="border-border bg-muted/40 flex items-center gap-2 rounded-xl border p-2 pl-3">
        <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-sm" title={url}>
          {url}
        </span>
        <Button variant={copied ? 'secondary' : 'default'} size="sm" className="shrink-0 gap-1.5" onClick={() => void copy(url)}>
          {copied ? <Icon name="check" className="size-3.5" /> : <Icon name="copy" className="size-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>

      <Separator />

      {/* passos */}
      <ol className="space-y-3">
        {[
          { n: 1, t: 'Abre o link', d: 'Chrome, Edge ou Safari — o mesmo Wi-Fi de casa.' },
          { n: 2, t: 'Introduz o PIN', d: 'Aparece no terminal do computador que está a servir.' },
          { n: 3, t: 'Partilha', d: 'Já podes trocar texto, imagens e ficheiros.' },
        ].map((step) => (
          <li key={step.n} className="flex gap-3">
            <span className="bg-secondary text-secondary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
              {step.n}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{step.t}</span>
              <span className="text-muted-foreground block text-sm">{step.d}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="bg-success/10 text-success flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-xs">
        <Icon name="shield" className="mt-px size-4 shrink-0" />
        <span className="leading-snug">
          <strong className="font-medium">100% offline.</strong> As ligações são diretas entre
          dispositivos — sem contas, sem servidores externos, sem nuvens.
        </span>
      </div>

      <p className="text-muted-foreground text-xs">
        Dica: no telemóvel, usa <span className="text-foreground">Adicionar ao ecrã principal</span> para
        instalar como app. Endereço base: <span className="font-mono">{origin}</span>
      </p>
    </DialogContent>
  )
}

function StatRow({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-1.5">
      <Icon name={icon} className="text-muted-foreground size-3.5 shrink-0" />
      <span className="text-sm font-medium tabular-nums">{value}</span>
      <span className="text-muted-foreground ml-auto truncate text-xs">{label}</span>
    </div>
  )
}

export default function StatusBar({ wsStatus, stats, onLogout }: StatusBarProps) {
  const [helpOpen, setHelpOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)

  const meta = STATUS_META[wsStatus]
  const connected = wsStatus === 'open'
  const reduced = prefersReducedMotion()
  const pwa = usePwaInstall()
  const { canInstall, install } = pwa

  const sizeLabel = useMemo(() => (stats.bytes > 0 ? formatBytes(stats.bytes) : '—'), [stats.bytes])

  const brand = (
    <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg shadow-sm">
      <Icon name="share" className="size-4" strokeWidth={2} />
    </div>
  )

  const helpButton = (
    <Tooltip>
      <TooltipTrigger>
        <Button variant="ghost" className="w-full justify-start gap-2.5" onClick={() => setHelpOpen(true)}>
          <Icon name="help" className="size-4" />
          <span className="hidden lg:inline">Ligar dispositivos</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">Como ligar outros dispositivos</TooltipContent>
    </Tooltip>
  )

  const logoutButton = (
    <Button
      variant="ghost"
      className="text-muted-foreground hover:text-destructive w-full justify-start gap-2.5"
      onClick={() => setLogoutOpen(true)}
    >
      <Icon name="logout" className="size-4" />
      <span className="hidden lg:inline">Sair</span>
    </Button>
  )

  return (
    <>
      {/* ── topo — mobile ────────────────────────────────────────────── */}
      <header className="border-border bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 flex items-center gap-3 border-b px-4 py-2.5 backdrop-blur-xl md:hidden">
        {brand}
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-tight font-semibold">LAN Share</p>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span
              className={cn('size-1.5 shrink-0 rounded-full', meta.dot, connected && !reduced && 'animate-pulse-ring')}
              aria-hidden="true"
            />
            {meta.label}
          </p>
        </div>

        <Tooltip>
          <TooltipTrigger>
            <Button variant="ghost" size="icon" className="size-9" aria-label="Como ligar outros dispositivos" onClick={() => setHelpOpen(true)}>
              <Icon name="help" className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ligar dispositivos</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger>
            <Button variant="ghost" size="icon" className="text-muted-foreground size-9" aria-label="Sair" onClick={() => setLogoutOpen(true)}>
              <Icon name="logout" className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sair da sessão</TooltipContent>
        </Tooltip>
      </header>

      {/* ── rail — desktop ───────────────────────────────────────────── */}
      <aside className="border-border bg-background hidden w-64 shrink-0 flex-col border-r md:flex">
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          {brand}
          <div className="min-w-0">
            <p className="text-sm leading-tight font-semibold">LAN Share</p>
            <p className="text-muted-foreground truncate text-xs">Partilha offline na rede</p>
          </div>
        </div>

        {/* estado da ligação */}
        <div className="px-4">
          <Badge
            variant={meta.tone === 'success' ? 'success' : 'warning'}
            className={cn('w-full justify-start gap-2 py-1.5 font-medium', !connected && 'animate-pulse')}
          >
            <span className={cn('size-1.5 shrink-0 rounded-full bg-current', connected && 'animate-pulse-ring')} aria-hidden="true" />
            {meta.label}
          </Badge>
          <p className="text-muted-foreground mt-2 px-0.5 text-xs leading-relaxed">{meta.hint}</p>
        </div>

        {/* acções */}
        <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
          {helpButton}
          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2.5"
                onClick={() => {
                  if (canInstall) {
                    void install().then((outcome) => {
                      if (outcome === 'accepted') toast.info('App instalada. Podes abri-la como uma app.')
                      else if (outcome === 'dismissed') toast.info('Instalação cancelada.')
                    })
                  } else {
                    setHelpOpen(true)
                  }
                }}
              >
                <Icon name={pwa.installed ? 'check' : 'share'} className="size-4" />
                <span className="hidden lg:inline">
                  {pwa.installed ? 'App instalada' : canInstall ? 'Instalar app' : 'Adicionar ao ecrã'}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {pwa.installed
                ? 'Já podes abrir a LAN Share como app'
                : canInstall
                  ? 'Instala a LAN Share neste dispositivo'
                  : 'Abre no telemóvel e usa "Adicionar ao ecrã principal"'}
            </TooltipContent>
          </Tooltip>
        </nav>

        {/* estatísticas da partilha */}
        <div className="px-3 pb-3">
          <Separator className="mb-2" />
          <div className="text-muted-foreground px-2.5 pb-1 text-[11px] font-semibold tracking-wider uppercase">
            Nesta partilha
          </div>
          <StatRow icon="send" value={String(stats.messages)} label={stats.messages === 1 ? 'mensagem' : 'mensagens'} />
          <StatRow icon="paperclip" value={String(stats.files)} label={stats.files === 1 ? 'ficheiro' : 'ficheiros'} />
          <StatRow icon="archive" value={sizeLabel} label="transferidos" />
        </div>

        <div className="border-border border-t p-3">{logoutButton}</div>
      </aside>

      {/* ── diálogos ─────────────────────────────────────────────────── */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <ConnectDialog />
      </Dialog>

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogIcon />
            <AlertDialogTitle>Sair desta sessão?</AlertDialogTitle>
            <AlertDialogDescription>
              Vais precisar do PIN outra vez para voltar a entrar. As mensagens que já foram partilhadas
              continuam guardadas no computador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLogoutOpen(false)}>Ficar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setLogoutOpen(false)
                onLogout()
              }}
            >
              <Icon name="logout" className="size-4" />
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}