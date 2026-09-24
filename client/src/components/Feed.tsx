import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import gsap from 'gsap'
import { toast } from 'sonner'
import { Share2, Upload } from 'lucide-react'
import type { Message } from '../types.ts'
import type { WsStatus } from '../ws.ts'
import { isAuthError, errorMessage, postMessage, uploadFile } from '../api.ts'
import { dayKey, formatDay } from '../lib/format.ts'
import { prefersReducedMotion } from '../lib/motion.ts'
import { Badge } from './ui/badge.tsx'
import StatusBar from './StatusBar.tsx'
import MessageItem from './MessageItem.tsx'
import Composer from './Composer.tsx'
import UploadCard, { type UploadTask } from './UploadCard.tsx'
import Reveal from './Reveal.tsx'

interface FeedProps {
  messages: Message[]
  wsStatus: WsStatus
  addMessage: (message: Message) => void
  onAuthFail: () => void
  onLogout: () => void
}

let taskKey = 0
const ABORT = 'AbortError'

export default function Feed({ messages, wsStatus, addMessage, onAuthFail, onLogout }: FeedProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const emptyRef = useRef<HTMLDivElement>(null)
  const dropBoxRef = useRef<HTMLDivElement>(null)

  const [tasks, setTasks] = useState<UploadTask[]>([])
  const [activeKey, setActiveKey] = useState<number | null>(null)
  const [dragDepth, setDragDepth] = useState(0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  // ── scroll automático só se o utilizador estiver no fundo ────────────
  useEffect(() => {
    const el = listRef.current
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight
  }, [messages])

  // ── ícone do estado vazio: flutuação suave ───────────────────────────
  useLayoutEffect(() => {
    const el = emptyRef.current
    if (!el || prefersReducedMotion() || messages.length > 0) return
    const anim = gsap.to(el, { y: -6, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    return () => {
      anim.kill()
    }
  }, [messages.length])

  const sendText = useCallback(
    async (body: string): Promise<boolean> => {
      try {
        const { message } = await postMessage(body)
        addMessage(message)
        return true
      } catch (err) {
        if (isAuthError(err)) {
          onAuthFail()
        } else {
          toast.error(errorMessage(err))
        }
        return false
      }
    },
    [addMessage, onAuthFail],
  )

  // ── fila de uploads: um de cada vez ──────────────────────────────────
  const enqueueFiles = useCallback((files: File[]) => {
    if (files.length === 0) return
    setTasks((prev) => [
      ...prev,
      ...files.map((file) => ({ key: ++taskKey, file, progress: 0, status: 'waiting' as const })),
    ])
  }, [])

  useEffect(() => {
    const next = tasks.find((t) => t.status === 'waiting')
    if (!next || activeKey !== null) return

    setActiveKey(next.key)
    const ac = new AbortController()
    abortRef.current = ac

    uploadFile(next.file, (p) => {
      setTasks((ts) => ts.map((t) => (t.key === next.key ? { ...t, progress: p.percent } : t)))
    }, ac.signal)
      .then(({ message }) => {
        addMessage(message)
        setTasks((ts) => ts.map((t) => (t.key === next.key ? { ...t, status: 'done' as const } : t)))
        setTimeout(() => {
          if (mountedRef.current) setTasks((ts) => ts.filter((t) => t.key !== next.key))
        }, 2200)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === ABORT) {
          setTasks((ts) => ts.filter((t) => t.key !== next.key))
          return
        }
        if (isAuthError(err)) {
          onAuthFail()
          return
        }
        const msg = errorMessage(err)
        toast.error(msg)
        setTasks((ts) => ts.map((t) => (t.key === next.key ? { ...t, status: 'error' as const, error: msg } : t)))
      })
      .finally(() => {
        abortRef.current = null
        setActiveKey(null)
      })
  }, [tasks, activeKey, addMessage, onAuthFail])

  const cancelTask = (key: number) => {
    if (activeKey === key) abortRef.current?.abort()
    else setTasks((ts) => ts.filter((t) => t.key !== key))
  }

  const retryTask = (key: number) => {
    setTasks((ts) => ts.map((t) => (t.key === key ? { ...t, status: 'waiting' as const, error: undefined } : t)))
  }

  // ── drag & drop ──────────────────────────────────────────────────────
  useEffect(() => {
    const enter = (e: DragEvent) => {
      e.preventDefault()
      setDragDepth((d) => d + 1)
    }
    const over = (e: DragEvent) => {
      e.preventDefault()
    }
    const leave = (e: DragEvent) => {
      e.preventDefault()
      setDragDepth((d) => Math.max(0, d - 1))
    }
    const drop = (e: DragEvent) => {
      e.preventDefault()
      setDragDepth(0)
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        enqueueFiles(Array.from(e.dataTransfer.files))
      }
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [enqueueFiles])

  // ── separadores de dia ───────────────────────────────────────────────
  const lastDayKey = useRef<string | null>(null)
  const rows: ReactNode[] = []
  let index = 0
  for (const message of messages) {
    const dk = dayKey(message.ts)
    if (dk !== lastDayKey.current) {
      lastDayKey.current = dk
      rows.push(
        <Reveal className="flex justify-center py-2" key={`day-${dk}`} delay={0.05}>
          <Badge variant="outline" className="bg-card/60 text-muted-foreground px-2.5 py-0.5">
            {formatDay(message.ts)}
          </Badge>
        </Reveal>,
      )
    }
    rows.push(
      <Reveal key={message.id} delay={Math.min(index * 0.015, 0.3)}>
        <MessageItem message={message} />
      </Reveal>,
    )
    index++
  }

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col">
      <StatusBar wsStatus={wsStatus} onLogout={onLogout} />

      <div
        ref={listRef}
        className="feed-scroll flex flex-1 flex-col gap-1 px-3 pt-3 pb-2 sm:px-5"
        onScroll={() => {
          const el = listRef.current
          if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
        }}
      >
        {messages.length === 0 ? (
          <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <div ref={emptyRef} className="bg-primary/10 text-primary flex size-16 items-center justify-center rounded-2xl">
              <Share2 className="size-7" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">Ainda não há mensagens.</p>
            <p className="text-xs">Abre este mesmo URL noutro telemóvel para partilhar.</p>
          </div>
        ) : (
          <>{rows}</>
        )}
      </div>

      {tasks.length > 0 ? (
        <div className="feed-scroll flex max-h-[38dvh] flex-col gap-2 px-3 pb-2 sm:px-5">
          {tasks.map((task) => (
            <UploadCard key={task.key} task={task} active={activeKey === task.key} onCancel={cancelTask} onRetry={retryTask} />
          ))}
        </div>
      ) : null}

      <Composer onSendText={sendText} onFiles={enqueueFiles} />

      {dragDepth > 0 ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm">
          <div
            ref={dropBoxRef}
            className="border-ring bg-card flex items-center gap-3 rounded-2xl border-2 border-dashed px-8 py-6 text-base font-medium text-white"
          >
            <Upload className="size-5" aria-hidden="true" />
            Larga aqui os ficheiros para enviar
          </div>
        </div>
      ) : null}
    </div>
  )
}