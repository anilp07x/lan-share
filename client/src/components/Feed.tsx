import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Icon from './Icon.tsx'
import type { Message } from '../types.ts'
import type { WsStatus } from '../ws.ts'
import { dayKey, formatDay } from '../lib/format.ts'
import { prefersReducedMotion } from '../lib/motion.ts'
import { cn } from '../lib/utils.ts'
import { Badge } from './ui/badge.tsx'
import StatusBar from './StatusBar.tsx'
import MessageItem from './MessageItem.tsx'
import Composer from './Composer.tsx'
import Reveal from './Reveal.tsx'

interface FeedProps {
  messages: Message[]
  wsStatus: WsStatus
  addMessage: (message: Message) => void
  onAuthFail: () => void
  onLogout: () => void
}

const BOTTOM_THRESHOLD = 96

export default function Feed({ messages, wsStatus, addMessage, onAuthFail, onLogout }: FeedProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const [atBottom, setAtBottom] = useState(true)
  const [unread, setUnread] = useState(0)
  const lastSeenIdRef = useRef<string | null>(null)
  const reduced = prefersReducedMotion()

  // ── scroll automático só se o utilizador estiver no fundo ────────────
  useEffect(() => {
    const el = listRef.current
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight
  }, [messages])

  // ── separadores de dia ───────────────────────────────────────────────
  const rows = useMemo(() => {
    const out: ReactNode[] = []
    let index = 0
    let prevDay: string | null = null
    for (const message of messages) {
      const dk = dayKey(message.ts)
      if (prevDay !== dk) {
        prevDay = dk
        const ts = message.ts
        out.push(<DaySeparator key={`day-${dk}`} ts={ts} />)
      }
      out.push(
        <Reveal key={message.id} delay={Math.min(index * 0.015, 0.3)} y={6}>
          <MessageItem message={message} />
        </Reveal>,
      )
      index++
    }
    return out
  }, [messages])

  // ── quantas mensagens chegaram depois da última vista ────────────────
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last) {
      lastSeenIdRef.current = null
      setUnread(0)
      return
    }
    if (atBottomRef.current || lastSeenIdRef.current === null) {
      lastSeenIdRef.current = last.id
      setUnread(0)
      return
    }
    const idx = messages.findIndex((m) => m.id === lastSeenIdRef.current)
    if (idx === -1) {
      // histórico recarregado ou ficheiro expirado — recomeça a contagem
      lastSeenIdRef.current = last.id
      setUnread(0)
      return
    }
    setUnread(messages.length - 1 - idx)
  }, [messages])

  const onScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD
    atBottomRef.current = bottom
    setAtBottom(bottom)
    if (bottom) {
      lastSeenIdRef.current = messages[messages.length - 1]?.id ?? null
      setUnread(0)
    }
  }, [messages])

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      const el = listRef.current
      if (!el) return
      el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : behavior })
      atBottomRef.current = true
      setAtBottom(true)
      lastSeenIdRef.current = messages[messages.length - 1]?.id ?? null
      setUnread(0)
    },
    [messages, reduced],
  )

  const stats = useMemo(() => {
    let files = 0
    let bytes = 0
    for (const m of messages) {
      if (m.kind === 'file') {
        files++
        bytes += m.file.size
      }
    }
    return { messages: messages.length, files, bytes }
  }, [messages])

  const connected = wsStatus === 'open'

  return (
    <div className="bg-background flex h-dvh flex-col md:flex-row">
      <StatusBar wsStatus={wsStatus} stats={stats} onLogout={onLogout} />

      <main className="relative flex min-h-0 flex-1 flex-col">
        {/* aviso de ligação perdida */}
        {!connected ? (
          <div
            role="status"
            className={cn(
              'flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium',
              wsStatus === 'reconnecting'
                ? 'bg-warning/12 text-warning'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <Icon name={wsStatus === 'reconnecting' ? 'retry' : 'loader'} className="size-3.5 animate-spin" />
            {wsStatus === 'reconnecting'
              ? 'Ligação perdida — a tentar voltar a ligar…'
              : 'A ligar ao servidor…'}
          </div>
        ) : null}

        <div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col px-4 pt-3 sm:px-6">
          <div
            ref={listRef}
            className="feed-scroll flex flex-1 flex-col gap-1 pb-2"
            onScroll={onScroll}
          >
            {messages.length === 0 ? (
              <EmptyState connected={connected} />
            ) : (
              <>{rows}</>
            )}
          </div>

          {/* botão "ir para o fim" — só quando há conteúdo por ver */}
          {!atBottom && messages.length > 0 ? (
            <div className="pointer-events-none sticky bottom-0 z-20 flex justify-center pb-1">
              <button
                type="button"
                onClick={() => scrollToBottom()}
                className={cn(
                  'bg-card pointer-events-auto flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg transition-transform hover:scale-[1.03] active:scale-95',
                  'focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
                  !reduced && 'animate-rise-in',
                )}
              >
                <Icon name="send" className="size-3.5 -rotate-90" />
                Novas mensagens
                {unread > 0 ? (
                  <Badge variant="default" className="ml-0.5 h-5 min-w-5 px-1.5 text-[11px] tabular-nums">
                    {unread > 99 ? '99+' : unread}
                  </Badge>
                ) : null}
              </button>
            </div>
          ) : null}

          <div className="pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Composer connected={wsStatus === 'open'} onMessage={addMessage} onAuthFail={onAuthFail} />
          </div>
        </div>
      </main>
    </div>
  )
}

function DaySeparator({ ts }: { ts: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5" role="separator" aria-label={formatDay(ts)}>
      <span className="bg-border h-px flex-1" aria-hidden="true" />
      <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {formatDay(ts)}
      </span>
      <span className="bg-border h-px flex-1" aria-hidden="true" />
    </div>
  )
}

function EmptyState({ connected }: { connected: boolean }) {
  const reduced = prefersReducedMotion()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <div className="relative">
        <div className="bg-primary/10 text-primary flex size-20 items-center justify-center rounded-3xl">
          <Icon name="share" className={`size-9${reduced ? '' : ' animate-float'}`} strokeWidth={1.5} />
        </div>
        {!reduced ? (
          <>
            <span className="bg-primary/20 absolute -top-1 -right-1 size-3 rounded-full" aria-hidden="true" />
            <span className="bg-success/25 absolute -bottom-1 -left-2 size-2.5 rounded-full" aria-hidden="true" />
          </>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <p className="text-lg font-semibold tracking-tight">Ainda não há nada por aqui</p>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm text-balance">
          {connected
            ? 'Abre este mesmo URL noutro telemóvel ou computador da tua rede e começa a partilhar.'
            : 'Assim que a ligação voltar, podes escrever e enviar ficheiros.'}
        </p>
      </div>

      <div className="text-muted-foreground/80 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
        <span className="flex items-center gap-1.5">
          <Icon name="zap" className="size-3.5" />
          Envio imediato
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="cloud-off" className="size-3.5" />
          Sem nuvem
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="shield" className="size-3.5" />
          Só a tua LAN
        </span>
      </div>
    </div>
  )
}