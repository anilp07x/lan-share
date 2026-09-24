import { useState } from 'react'
import Icon from './Icon.tsx'
import type { WsStatus } from '../ws.ts'
import { useCopied } from '../hooks/useCopied.ts'
import { cn } from '../lib/utils.ts'
import { Button } from './ui/button.tsx'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog.tsx'

interface StatusBarProps {
  wsStatus: WsStatus
  onLogout: () => void
}

function HelpContent() {
  const { copied, copy } = useCopied()
  const url = typeof window !== 'undefined' ? window.location.href : ''
  return (
    <>
      <DialogHeader>
        <DialogTitle>Ligar outros dispositivos</DialogTitle>
        <DialogDescription>Abre este endereço noutro telemóvel ou computador que esteja na mesma rede.</DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-2 rounded-lg border p-3">
        <Icon name="link" className="text-primary size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{url}</span>
        <Button variant="outline" size="sm" onClick={() => void copy(url)}>
          {copied ? <Icon name="check" className="size-3.5 text-success" /> : <Icon name="copy" className="size-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
      <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
        <li>Abre o link num navegador (Chrome/Edge/Safari).</li>
        <li>Introduz o PIN que aparece no terminal do computador.</li>
        <li>Pronto — podes trocar texto e ficheiros.</li>
      </ol>
      <div aria-hidden="true" className="bg-border my-2 h-px w-full" />
      <p className="text-muted-foreground text-xs">
        Dica: para instalar como app no telemóvel, usa "Adicionar ao ecrã principal".
      </p>
    </>
  )
}

export default function StatusBar({ wsStatus, onLogout }: StatusBarProps) {
  const [helpOpen, setHelpOpen] = useState(false)

  const connected = wsStatus === 'open'
  const label = connected ? 'Ligado' : wsStatus === 'connecting' ? 'A ligar…' : 'A reconectar…'

  const brand = (
    <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
      <Icon name="share" className="size-4" />
    </div>
  )

  return (
    <>
      {/* header — mobile */}
      <header className="border-border bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-40 flex items-center gap-3 border-b px-4 py-2.5 backdrop-blur md:hidden">
        {brand}
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-tight font-semibold">LAN Share</p>
          <div className="flex items-center gap-1.5">
            <div className={cn('size-1.5 rounded-full', connected ? 'bg-success' : 'bg-warning')} aria-hidden="true" />
            <span className="text-muted-foreground text-xs">{label}</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="size-9" aria-label="Como ligar outros dispositivos" onClick={() => setHelpOpen(true)}>
          <Icon name="help" className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-9" aria-label="Sair" onClick={onLogout}>
          <Icon name="logout" className="size-4" />
        </Button>
      </header>

      {/* rail — desktop */}
      <aside className="border-border hidden w-64 shrink-0 flex-col border-r bg-background md:flex">
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          {brand}
          <div>
            <p className="text-sm leading-tight font-semibold">LAN Share</p>
            <p className="text-muted-foreground text-xs">Partilha offline na rede</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 pb-2">
          <div className={cn('size-1.5 rounded-full', connected ? 'bg-success' : 'bg-warning')} aria-hidden="true" />
          <span className="text-muted-foreground text-xs">{label}</span>
        </div>
        <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
          <Button variant="ghost" className="justify-start gap-2" onClick={() => setHelpOpen(true)}>
<Icon name="help" className="size-4" />
            Como ligar
          </Button>
        </nav>
        <div className="border-border border-t p-3">
          <Button variant="ghost" className="text-muted-foreground w-full justify-start gap-2" onClick={onLogout}>
<Icon name="logout" className="size-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* diálogo partilhado */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <HelpContent />
        </DialogContent>
      </Dialog>
    </>
  )
}