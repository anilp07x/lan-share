import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Check, Copy, CircleHelp, Link2, LogOut, Share2 } from 'lucide-react'
import type { WsStatus } from '../ws.ts'
import { prefersReducedMotion } from '../lib/motion.ts'
import { useCopied } from '../hooks/useCopied.ts'
import { cn } from '../lib/utils.ts'
import { Badge } from './ui/badge.tsx'
import { Button } from './ui/button.tsx'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.tsx'
import { Separator } from './ui/separator.tsx'

interface StatusBarProps {
  wsStatus: WsStatus
  onLogout: () => void
}

export default function StatusBar({ wsStatus, onLogout }: StatusBarProps) {
  const { copied, copy } = useCopied()
  const dotRef = useRef<HTMLDivElement>(null)

  const connected = wsStatus === 'open'
  const label = connected ? 'Ligado' : wsStatus === 'connecting' ? 'A ligar…' : 'A reconectar…'
  const url = typeof window !== 'undefined' ? window.location.href : ''

  useLayoutEffect(() => {
    const el = dotRef.current
    if (!el || prefersReducedMotion() || connected) return
    const anim = gsap.to(el, {
      opacity: 0.35,
      duration: 0.7,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    })
    return () => {
      anim.kill()
    }
  }, [connected])

  return (
    <header className="bg-background/85 supports-[backdrop-filter]:bg-background/70 border-border sticky top-0 z-40 flex items-center gap-3 border-b px-4 py-2.5 backdrop-blur">
      <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Share2 className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-tight font-semibold">LAN Share</p>
        <div className="flex items-center gap-1.5">
          <div
            ref={dotRef}
            className={cn(
              'size-1.5 rounded-full',
              connected ? 'bg-success' : 'bg-warning',
            )}
            aria-hidden="true"
          />
          <span className="text-muted-foreground text-xs">{label}</span>
        </div>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="size-9" aria-label="Como ligar outros dispositivos">
            <CircleHelp className="size-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ligar outros dispositivos</DialogTitle>
            <DialogDescription>
              Abre este endereço noutro telemóvel ou computador que esteja na mesma rede.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <Link2 className="text-primary size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{url}</span>
            <Button variant="outline" size="sm" onClick={() => void copy(url)}>
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
          <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
            <li>Abre o link num navegador (Chrome/Edge/Safari).</li>
            <li>Introduz o PIN que aparece no terminal do computador.</li>
            <li>Pronto — podes trocar texto e ficheiros.</li>
          </ol>
          <Separator />
          <p className="text-muted-foreground text-xs">
            Dica: para instalar como app no telemóvel, usa "Adicionar ao ecrã principal".
          </p>
        </DialogContent>
      </Dialog>

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground shrink-0 gap-1.5"
        onClick={onLogout}
      >
        <LogOut className="size-4" />
        <span className="hidden sm:inline">Sair</span>
      </Button>
    </header>
  )
}