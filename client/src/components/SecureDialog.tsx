import { useState, type ReactNode } from 'react'
import Icon from './Icon.tsx'
import QrCode from './QrCode.tsx'
import type { ServerInfo } from '../types.ts'
import { useCopied } from '../hooks/useCopied.ts'
import { cn } from '../lib/utils.ts'
import { Button } from './ui/button.tsx'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog.tsx'

type Platform = 'iphone' | 'android' | 'pc'

const STEPS: Record<Platform, string[]> = {
  iphone: [
    'Abre o código 1 no Safari e toca em «Permitir».',
    'Definições › Perfil descarregado › Instalar.',
    'Definições › Geral › Informações › Confiança de certificados: ativa «LAN Share CA».',
    'Para avisos com o ecrã noutra app: no Safari, Partilhar › Adicionar ao ecrã principal.',
  ],
  android: [
    'Abre o código 1 e descarrega o certificado.',
    'Definições › Segurança › Mais definições › Instalar a partir do armazenamento › Certificado da AC.',
    'Escolhe «LAN-Share-CA.crt» e confirma.',
  ],
  pc: [
    'Descarrega o certificado (código 1 ou o endereço ao lado) e abre o ficheiro.',
    'Instalar certificado › Utilizador atual › Colocar no arquivo «Autoridades de Certificação de Raiz Fidedignas».',
    'Na app LAN Share para Windows basta o botão «Instalar certificado neste PC».',
  ],
}

function guessPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iphone'
  if (/Android/.test(ua)) return 'android'
  return 'pc'
}

function Step({ n, title, url, children }: { n: number; title: string; url: string; children?: ReactNode }) {
  const { copied, copy } = useCopied()
  return (
    <section className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="bg-shell flex shrink-0 flex-col items-center gap-2 self-center rounded-2xl p-3 sm:self-start">
        <div className="rounded-lg bg-white p-1.5 text-[#13201b]">
          <QrCode value={url} className="size-32" />
        </div>
        <span className="tag text-shell-muted text-[11px]">Código {n}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="display text-xl">
          {n}. {title}
        </h3>
        <div className="border-border bg-muted/60 flex items-center gap-2 rounded-xl border p-1.5 pl-3">
          <a href={url} className="min-w-0 flex-1 truncate text-sm font-medium tabular-nums underline-offset-2 hover:underline">
            {url.replace(/^https?:\/\//, '')}
          </a>
          <Button variant="outline" size="sm" onClick={() => void copy(url)}>
            <Icon name={copied ? 'check' : 'copy'} className={cn('size-3.5', copied && 'text-success')} />
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        {children}
      </div>
    </section>
  )
}

interface SecureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  secure: NonNullable<ServerInfo['secure']>
}

/**
 * Ativar avisos nos telemóveis: o browser só os mostra em HTTPS, e o HTTPS
 * da LAN Share usa um certificado próprio que cada dispositivo instala uma vez.
 */
export default function SecureDialog({ open, onOpenChange, secure }: SecureDialogProps) {
  const [platform, setPlatform] = useState<Platform>(guessPlatform)
  const secureUrl = secure.primaryUrl ?? secure.mdnsUrl

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ativar avisos no telemóvel</DialogTitle>
          <DialogDescription>
            Os avisos do sistema só funcionam numa ligação segura. Faz isto uma vez em cada dispositivo: instala o
            certificado deste computador e passa a abrir a LAN Share pelo endereço seguro.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 flex flex-col gap-6">
          <Step n={1} title="Instalar o certificado" url={secure.caUrl}>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dispositivo">
              {(
                [
                  ['iphone', 'iPhone'],
                  ['android', 'Android'],
                  ['pc', 'Computador'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={platform === id}
                  onClick={() => setPlatform(id)}
                  className={cn(
                    'tag rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                    platform === id
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
              {STEPS[platform].map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </Step>

          <Step n={2} title="Abrir pelo endereço seguro" url={secureUrl}>
            <p className="text-muted-foreground text-sm">
              Entra com o mesmo PIN e liga o sino. Também funciona{' '}
              <a href={secure.mdnsUrl} className="text-signal-ink font-medium underline underline-offset-2">
                {secure.mdnsUrl.replace(/^https:\/\//, '')}
              </a>{' '}
              nos dispositivos que reconhecem nomes «.local» (iPhone, Mac, Windows).
            </p>
          </Step>

          <p className="bg-muted/60 text-muted-foreground rounded-xl px-3.5 py-2.5 text-sm">
            O certificado foi criado por este computador e a chave privada nunca sai dele. Se o browser avisar que a
            ligação não é privada, o passo 1 ainda não ficou concluído nesse dispositivo.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
