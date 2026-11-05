import { useEffect, useState } from 'react'
import Icon from './Icon.tsx'
import QrCode from './QrCode.tsx'
import type { Sender, ServerInfo } from '../types.ts'
import { useCopied } from '../hooks/useCopied.ts'
import { useDevice } from '../lib/device.ts'
import { cn } from '../lib/utils.ts'
import { Button } from './ui/button.tsx'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog.tsx'
import StationList from './StationList.tsx'

interface ConnectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  info: ServerInfo | null
  peers: Sender[]
  onRename: () => void
  /** Abre o guia do HTTPS (só quando o servidor o tem e esta página ainda é HTTP). */
  onSecureSetup?: () => void
}

const LOOPBACK = /^(localhost|127\.|\[::1\])/

/** Na app LAN Share para Windows o PIN vem do próprio servidor. */
const desktop = (window as { lanShareDesktop?: { getPin: () => Promise<string | null> } }).lanShareDesktop

/** Endereços que outro dispositivo consegue abrir (o loopback do PC não serve). */
function joinUrls(info: ServerInfo | null): string[] {
  const here = window.location.origin
  // numa página segura, o QR também leva à versão segura
  const secure = window.location.protocol === 'https:' ? info?.secure : null
  const lan = (secure ? [...secure.urls, secure.mdnsUrl] : info?.urls) ?? []
  if (!LOOPBACK.test(window.location.hostname)) return [here, ...lan.filter((u) => u !== here)]
  if (lan.length === 0) return [here]
  const primary = (secure ? secure.primaryUrl : info?.primaryUrl) ?? lan[0]!
  return [primary, ...lan.filter((u) => u !== primary)]
}

export default function ConnectDialog({ open, onOpenChange, info, peers, onRename, onSecureSetup }: ConnectDialogProps) {
  const urls = joinUrls(info)
  const [selected, setSelected] = useState(urls[0] ?? '')
  const { copied, copy } = useCopied()
  const device = useDevice()
  const [pin, setPin] = useState<string | null>(null)

  useEffect(() => {
    if (open) setSelected(joinUrls(info)[0] ?? '')
  }, [open, info])

  useEffect(() => {
    if (open && desktop) void desktop.getPin().then(setPin).catch(() => {})
  }, [open])

  const isLoopbackOnly = LOOPBACK.test(new URL(selected || window.location.origin).hostname)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <div className="grid sm:grid-cols-[minmax(0,15rem)_1fr]">
          <div className="bg-shell text-shell-foreground flex flex-col items-center gap-3 rounded-t-[inherit] p-6 sm:rounded-l-[inherit] sm:rounded-tr-none">
            <div className="rounded-xl bg-white p-2.5 text-[#13201b]">
              <QrCode value={selected} className="size-44 sm:size-48" />
            </div>
            <p className="tag text-shell-muted text-center text-xs">Aponta a câmara do outro telemóvel</p>
          </div>

          <div className="flex min-w-0 flex-col gap-5 p-6">
            <DialogHeader>
              <DialogTitle>Ligar outro dispositivo</DialogTitle>
              <DialogDescription>
                Tem de estar na mesma rede Wi‑Fi. Depois de abrir o endereço, introduz o PIN
                {pin ? ' abaixo.' : ' que aparece no terminal do computador.'}
              </DialogDescription>
            </DialogHeader>

            {pin ? (
              <div className="flex flex-col gap-2">
                <span className="tag text-muted-foreground text-xs">PIN de acesso</span>
                <span className="display text-[34px] tracking-[0.14em] tabular-nums">{pin}</span>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <span className="tag text-muted-foreground text-xs">Endereço</span>
              <div className="border-border bg-muted/60 flex items-center gap-2 rounded-xl border p-1.5 pl-3">
                <span className="min-w-0 flex-1 truncate font-medium tabular-nums">{selected}</span>
                <Button variant="outline" size="sm" onClick={() => void copy(selected)}>
                  <Icon name={copied ? 'check' : 'copy'} className={cn('size-3.5', copied && 'text-success')} />
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
              {urls.length > 1 ? (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Outros endereços deste computador">
                  {urls.map((u) => (
                    <button
                      key={u}
                      type="button"
                      aria-pressed={u === selected}
                      onClick={() => setSelected(u)}
                      className={cn(
                        'tag rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                        u === selected
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {new URL(u).host}
                    </button>
                  ))}
                </div>
              ) : null}
              {isLoopbackOnly ? (
                <p className="text-warning text-sm">
                  Este endereço só funciona neste computador. Liga-o a uma rede para os outros entrarem.
                </p>
              ) : null}
            </div>

            {onSecureSetup ? (
              <button
                type="button"
                onClick={onSecureSetup}
                className="bg-signal-wash hover:bg-signal-wash/70 flex items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors"
              >
                <Icon name="bell" className="text-signal-ink size-5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Avisos no telemóvel</span>
                  <span className="text-muted-foreground block text-sm">Ligação segura com o certificado deste PC</span>
                </span>
                <Icon name="chevron-right" className="text-muted-foreground size-4 shrink-0" />
              </button>
            ) : null}

            <div className="flex flex-col gap-2">
              <span className="tag text-muted-foreground text-xs">Estações ligadas · {peers.length}</span>
              <StationList peers={peers} selfId={device.id} />
            </div>

            <button
              type="button"
              onClick={onRename}
              className="border-border hover:bg-accent -mt-1 flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors"
            >
              <span className="min-w-0 flex-1">
                <span className="tag text-muted-foreground block text-[11px]">Este dispositivo</span>
                <span className="block truncate text-sm font-medium">{device.name}</span>
              </span>
              <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <Icon name="pencil" className="size-3.5" />
                Mudar nome
              </span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
