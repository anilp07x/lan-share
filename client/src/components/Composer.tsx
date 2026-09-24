import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import { toast } from '../lib/toast.tsx'
import Icon from './Icon.tsx'
import type { Message } from '../types.ts'
import { errorMessage, isAuthError, postMessage, uploadFile } from '../api.ts'
import { cn } from '../lib/utils.ts'
import { PREVIEW_MAX_BYTES } from '../lib/format.ts'
import { Button } from './ui/button.tsx'
import UploadChip, { type UploadTask } from './UploadChip.tsx'

interface ComposerProps {
  connected: boolean
  onMessage: (message: Message) => void
  onAuthFail: () => void
}

let taskKey = 0

export default function Composer({ connected, onMessage, onAuthFail }: ComposerProps) {
  const [text, setText] = useState('')
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const [activeKey, setActiveKey] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [dragDepth, setDragDepth] = useState(0)
  const [announce, setAnnounce] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const desktopRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    desktopRef.current = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  function enqueueFiles(files: File[]) {
    if (files.length === 0) return
    setTasks((prev) => [
      ...prev,
      ...files.map((file) => ({
        key: ++taskKey,
        file,
        thumbUrl: file.type.startsWith('image/') && file.size <= PREVIEW_MAX_BYTES ? URL.createObjectURL(file) : undefined,
        progress: 0,
        status: 'waiting' as const,
      })),
    ])
  }

  function removeTask(key: number) {
    if (activeKey === key) abortRef.current?.abort()
    const task = tasks.find((t) => t.key === key)
    if (task?.thumbUrl) URL.revokeObjectURL(task.thumbUrl)
    setTasks((prev) => prev.filter((t) => t.key !== key))
  }

  function retryTask(key: number) {
    setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, status: 'waiting' as const, error: undefined } : t)))
  }

  // fila de uploads: um de cada vez, só depois de o utilizador enviar
  useEffect(() => {
    if (!processing || activeKey !== null) return
    const next = tasks.find((t) => t.status === 'waiting')
    if (!next) return

    setActiveKey(next.key)
    const ac = new AbortController()
    abortRef.current = ac
    uploadFile(next.file, (p) => {
      setTasks((prev) => prev.map((t) => (t.key === next.key ? { ...t, progress: p.percent } : t)))
    }, ac.signal)
      .then(({ message }) => {
        if (!mountedRef.current) return
        onMessage(message)
        setAnnounce(`Anexo enviado: ${next.file.name}`)
        setTasks((prev) => prev.map((t) => (t.key === next.key ? { ...t, status: 'done' as const } : t)))
        setTimeout(() => {
          if (mountedRef.current) setTasks((prev) => prev.filter((t) => t.key !== next.key))
        }, 1500)
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return
        if (err instanceof DOMException && err.name === 'AbortError') {
          setTasks((prev) => prev.filter((t) => t.key !== next.key))
          return
        }
        if (isAuthError(err)) {
          onAuthFail()
          return
        }
        const msg = errorMessage(err)
        toast.error(msg)
        setAnnounce(`Falha ao enviar ${next.file.name}`)
        setTasks((prev) => prev.map((t) => (t.key === next.key ? { ...t, status: 'error' as const, error: msg } : t)))
      })
      .finally(() => {
        abortRef.current = null
        setActiveKey(null)
      })
  }, [processing, activeKey, tasks, onMessage, onAuthFail])

  useEffect(() => {
    if (processing && !tasks.some((t) => t.status === 'waiting' || t.status === 'uploading')) {
      setProcessing(false)
      setActiveKey(null)
    }
  }, [processing, tasks])

  const submit = async (e?: FormEvent): Promise<void> => {
    e?.preventDefault()
    const body = text.trim()
    if (sending) return
    if (!body && tasks.length === 0) return
    if (tasks.length > 0) setProcessing(true)
    if (!body) return
    setSending(true)
    try {
      const { message } = await postMessage(body)
      onMessage(message)
      setText('')
    } catch (err) {
      if (isAuthError(err)) {
        onAuthFail()
        return
      }
      toast.error(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  function onPickerChange(e: ChangeEvent<HTMLInputElement>) {
    enqueueFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  function onPaste(e: ClipboardEvent) {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
    if (files.length > 0) {
      e.preventDefault()
      enqueueFiles(files)
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && desktopRef.current) {
      e.preventDefault()
      void submit()
    }
  }

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
  }, [])

  const hasContent = text.trim().length > 0 || tasks.length > 0
  const canSend = !sending && hasContent

  return (
    <>
      <div className="border-border bg-card rounded-2xl border">
        {!connected ? (
          <div className="flex items-center gap-1.5 px-3 pt-2 text-[11px] text-muted-foreground">
            <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
            Ligação perdida — o envio vai tentar novamente.
          </div>
        ) : null}

        {tasks.length > 0 ? (
          <div className="feed-scroll flex max-h-[38dvh] flex-wrap content-start gap-1.5 px-2 pt-2">
            {tasks.map((task) => (
              <UploadChip key={task.key} task={task} active={activeKey === task.key} onRemove={removeTask} onRetry={retryTask} />
            ))}
          </div>
        ) : null}

        <form onSubmit={(e) => void submit(e)} className="flex items-end gap-1.5 px-2 py-1.5">
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={onPickerChange}
            aria-label="Escolher ficheiros"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground shrink-0 rounded-full"
            onClick={() => fileRef.current?.click()}
            aria-label="Anexar ficheiro"
            title="Anexar ficheiro"
          >
            <Icon name="plus" className="size-5" />
          </Button>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={onPaste}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Escreve uma mensagem…"
            aria-label="Mensagem"
            className="min-h-11 max-h-40 min-w-0 flex-1 resize-none place-self-center rounded-xl bg-transparent py-2.5 text-[17px] leading-relaxed outline-none"
            style={{ fieldSizing: 'content' }}
          />

          <Button
            type="submit"
            size="icon"
            disabled={!canSend}
            className={cn('shrink-0 rounded-full', canSend ? 'bg-primary text-primary-foreground active:scale-95' : 'bg-muted text-muted-foreground')}
            aria-label="Enviar mensagem"
            title="Enviar (Enter)"
          >
            {sending ? <Icon name="loader" className="size-5 animate-spin" /> : <Icon name="send" className="size-5" />}
          </Button>
        </form>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>

      {dragDepth > 0 ? (
        <div className="bg-background/80 fixed inset-0 z-50 grid place-items-center p-6 backdrop-blur-sm">
          <div className="border-ring bg-card flex items-center gap-3 rounded-2xl border-2 border-dashed px-8 py-6 text-base font-medium text-foreground">
            <Icon name="upload" className="size-5" />
            Larga aqui os ficheiros para enviar
          </div>
        </div>
      ) : null}
    </>
  )
}