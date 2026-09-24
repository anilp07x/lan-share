import { useEffect, useRef, type ReactNode } from 'react'
import Icon from './Icon.tsx'
import type { Message } from '../types.ts'
import type { WsStatus } from '../ws.ts'
import { dayKey, formatDay } from '../lib/format.ts'
import { prefersReducedMotion } from '../lib/motion.ts'
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

export default function Feed({ messages, wsStatus, addMessage, onAuthFail, onLogout }: FeedProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const reduced = prefersReducedMotion()

  // ── scroll automático só se o utilizador estiver no fundo ────────────
  useEffect(() => {
    const el = listRef.current
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight
  }, [messages])

  // ── separadores de dia ───────────────────────────────────────────────
  const rows: ReactNode[] = []
  let index = 0
  let prevDay: string | null = null
  for (const message of messages) {
    const dk = dayKey(message.ts)
    if (prevDay !== dk) {
      prevDay = dk
      rows.push(
        <div className="flex items-center gap-3 py-2.5" key={`day-${dk}`}>
          <div className="bg-border h-px flex-1" aria-hidden="true" />
          <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            {formatDay(message.ts)}
          </span>
          <div className="bg-border h-px flex-1" aria-hidden="true" />
        </div>,
      )
    }
    rows.push(
      <Reveal key={message.id} delay={Math.min(index * 0.015, 0.3)} y={6}>
        <MessageItem message={message} />
      </Reveal>,
    )
    index++
  }

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <StatusBar wsStatus={wsStatus} onLogout={onLogout} />

      <main className="flex min-h-0 flex-1 flex-col">
        <div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col px-4 pt-3 sm:px-6">
          <div
            ref={listRef}
            className="feed-scroll flex flex-1 flex-col gap-1 pb-2"
            onScroll={() => {
              const el = listRef.current
              if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
            }}
          >
            {messages.length === 0 ? (
              <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <div className="bg-primary/10 text-primary flex size-16 items-center justify-center rounded-2xl">
                  <Icon name="share" className={`size-7${reduced ? '' : ' animate-float'}`} />
                </div>
                <p className="text-sm font-medium">Ainda não há mensagens.</p>
                <p className="text-xs">Abre este mesmo URL noutro telemóvel para partilhar.</p>
              </div>
            ) : (
              <>{rows}</>
            )}
          </div>

          <div className="pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Composer connected={wsStatus === 'open'} onMessage={addMessage} onAuthFail={onAuthFail} />
          </div>
        </div>
      </main>
    </div>
  )
}