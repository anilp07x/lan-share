import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.tsx'
import type { Sender } from '../types.ts'
import { senderHue } from '../lib/device.ts'
import { cn } from '../lib/utils.ts'

interface RecipientPickerProps {
  /** Dispositivos ligados, sem este. */
  peers: Sender[]
  value: Sender[]
  onChange: (value: Sender[]) => void
}

export function recipientsLabel(value: Sender[]): string {
  if (value.length === 0) return 'Todos'
  if (value.length <= 2) return value.map((r) => r.name).join(' e ')
  return `${value[0]!.name} e mais ${value.length - 1}`
}

/** "Para: Todos ▾" — escolher a quem enviar. Vazio = todos os dispositivos. */
export default function RecipientPicker({ peers, value, onChange }: RecipientPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = new Set(value.map((r) => r.id))
  // quem saiu entretanto continua na lista enquanto estiver escolhido
  const options = [...peers, ...value.filter((r) => !peers.some((p) => p.id === r.id))]
  const isPrivate = value.length > 0

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = (peer: Sender) =>
    onChange(selected.has(peer.id) ? value.filter((r) => r.id !== peer.id) : [...value, peer])

  return (
    <div ref={rootRef} className="relative flex min-w-0 items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'tag flex h-8 min-w-0 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors',
          isPrivate
            ? 'bg-signal-wash text-signal-ink hover:bg-signal-wash/70'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <Icon name={isPrivate ? 'lock' : 'users'} className="size-3.5 shrink-0" />
        <span className="truncate">
          {isPrivate ? 'Só para ' : 'Para: '}
          {recipientsLabel(value)}
        </span>
        <Icon name="chevron-right" className={cn('size-3.5 shrink-0 transition-transform', open ? '-rotate-90' : 'rotate-90')} />
      </button>
      {isPrivate ? (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-full"
          aria-label="Enviar para todos"
          title="Enviar para todos"
        >
          <Icon name="x" className="size-3.5" />
        </button>
      ) : null}

      {open ? (
        <div
          role="group"
          aria-label="Destinatários"
          className="bg-popover text-popover-foreground animate-dialog-in absolute bottom-full left-0 z-30 mb-2 w-64 rounded-2xl border p-1.5 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.5)]"
        >
          <button
            type="button"
            aria-pressed={!isPrivate}
            onClick={() => {
              onChange([])
              setOpen(false)
            }}
            className="hover:bg-accent flex h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm"
          >
            <Icon name="users" className="text-muted-foreground size-4" />
            <span className="flex-1">Todos os dispositivos</span>
            {!isPrivate ? <Icon name="check" className="text-signal-ink size-4" /> : null}
          </button>
          <p className="tag text-muted-foreground px-2.5 pt-2 pb-1 text-[11px]">Só para</p>
          {options.length === 0 ? (
            <p className="text-muted-foreground px-2.5 pb-2 text-sm">Nenhum outro dispositivo ligado.</p>
          ) : (
            options.map((peer) => {
              const on = selected.has(peer.id)
              const online = peers.some((p) => p.id === peer.id)
              return (
                <button
                  key={peer.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(peer)}
                  className="hover:bg-accent flex h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm"
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: senderHue(peer.id) }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">
                    {peer.name}
                    {online ? null : <span className="text-muted-foreground"> · desligado</span>}
                  </span>
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-md border',
                      on ? 'bg-primary border-primary text-primary-foreground' : 'border-input',
                    )}
                    aria-hidden="true"
                  >
                    {on ? <Icon name="check" className="size-3.5" /> : null}
                  </span>
                </button>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}
