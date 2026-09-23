import { useCallback, useEffect, useRef, useState } from 'react'
import type { Message } from '../types.ts'
import type { WsStatus } from '../ws.ts'
import { isAuthError, errorMessage, postMessage, uploadFile } from '../api.ts'
import { dayKey, formatDay } from '../lib/format.ts'
import StatusBar from './StatusBar.tsx'
import MessageItem from './MessageItem.tsx'
import Composer from './Composer.tsx'
import UploadCard, { type UploadTask } from './UploadCard.tsx'

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

  const [tasks, setTasks] = useState<UploadTask[]>([])
  const [activeKey, setActiveKey] = useState<number | null>(null)
  const [dragDepth, setDragDepth] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

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

  function pushToast(text: string) {
    setToast(text)
    setTimeout(() => {
      if (mountedRef.current) setToast(null)
    }, 4000)
  }

  const sendText = useCallback(
    async (body: string): Promise<boolean> => {
      try {
        const { message } = await postMessage(body)
        addMessage(message)
        return true
      } catch (err) {
        if (isAuthError(err)) {
          onAuthFail()
          return false
        }
        pushToast(errorMessage(err))
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
        }, 2500)
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
        pushToast(msg)
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
    function enter(e: DragEvent) {
      e.preventDefault()
      setDragDepth((d) => d + 1)
    }
    function over(e: DragEvent) {
      e.preventDefault()
    }
    function leave(e: DragEvent) {
      e.preventDefault()
      setDragDepth((d) => Math.max(0, d - 1))
    }
    function drop(e: DragEvent) {
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

  const lastDayKey = useRef<string | null>(null)

  const rows: React.ReactNode[] = []
  for (const message of messages) {
    const dk = dayKey(message.ts)
    if (dk !== lastDayKey.current) {
      lastDayKey.current = dk
      rows.push(
        <div className="day-sep" key={`day-${dk}`}>
          {formatDay(message.ts)}
        </div>,
      )
    }
    rows.push(<MessageItem key={message.id} message={message} />)
  }

  return (
    <div className="feed">
      <StatusBar wsStatus={wsStatus} onLogout={onLogout} />

      <div
        ref={listRef}
        className="messages"
        onScroll={() => {
          const el = listRef.current
          if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
        }}
      >
        {messages.length === 0 ? (
          <div className="empty">
            <p>Ainda não há mensagens.</p>
            <p className="empty-sub">Abre este mesmo URL noutro telemóvel para partilhar.</p>
          </div>
        ) : (
          rows
        )}
      </div>

      {tasks.length > 0 ? (
        <div className="uploads">
          {tasks.map((task) => (
            <UploadCard key={task.key} task={task} active={activeKey === task.key} onCancel={cancelTask} onRetry={retryTask} />
          ))}
        </div>
      ) : null}

      <Composer onSendText={sendText} onFiles={enqueueFiles} />

      {dragDepth > 0 ? (
        <div className="drop-overlay">
          <div className="drop-box">Larga aqui os ficheiros para enviar</div>
        </div>
      ) : null}

      {toast ? (
        <div className="toast" role="alert">
          {toast}
        </div>
      ) : null}
    </div>
  )
}