import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { toast } from '../lib/toast.tsx'
import Icon from './Icon.tsx'
import type { Message } from '../types.ts'
import { errorMessage, isAuthError, postMessage, uploadFile } from '../api.ts'
import { cn } from '../lib/utils.ts'
import { prefersReducedMotion } from '../lib/motion.ts'
import { PREVIEW_MAX_BYTES } from '../lib/format.ts'
import { Spinner } from './ui/spinner.tsx'
import { Button } from './ui/button.tsx'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.tsx'
import UploadChip, { type UploadTask } from './UploadChip.tsx'

interface ComposerProps {
  connected: boolean
  onMessage: (message: Message) => void
  onAuthFail: () => void
}

/** Acima disto o texto fica demasiado para o feed em telemóvel. */
const MAX_CHARS = 2000

let taskKey = 0

export default function Composer({ connected, onMessage, onAuthFail }: ComposerProps) {
  const [text, setText] = useState('')
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const [activeKey, setActiveKey] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [dragDepth, setDragDepth] = useState(0)
  const [announce, setAnnounce] = useState('')
  const [focused, setFocused] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
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
    const tooBig = files.filter((f) => f.size > PREVIEW_MAX_BYTES * 10)
    const ok = tooBig.length > 0 ? files.filter((f) => f.size <= PREVIEW_MAX_BYTES * 10) : files
    if (tooBig.length > 0) {
      toast.error(
        tooBig.length === 1
          ? `${tooBig[0]?.name ?? 'Ficheiro'} excede o limite de tamanho.`
          : `${tooBig.length} ficheiros excedem o limite de tamanho.`,
      )
    }
    if (ok.length === 0) return
    setTasks((prev) => [
      ...prev,
      ...ok.map((file) => ({
        key: ++taskKey,
        file,
        thumbUrl:
          file.type.startsWith('image/') && file.size <= PREVIEW_MAX_BYTES
            ? URL.createObjectURL(file)
            : undefined,
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
    setTasks((prev) =>
      prev.map((t) => (t.key === key ? { ...t, status: 'waiting' as const, error: undefined } : t)),
    )
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
      setTasks((prev) =>
        prev.map((t) => (t.key === next.key ? { ...t, progress: p.percent, status: 'uploading' } : t)),
      )
    }, ac.signal)
      .then(({ message }) => {
        if (!mountedRef.current) return
        onMessage(message)
        setAnnounce(`Anexo enviado: ${next.file.name}`)
        setTasks((prev) =>
          prev.map((t) => (t.key === next.key ? { ...t, status: 'done' as const } : t)),
        )
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
        setTasks((prev) =>
          prev.map((t) => (t.key === next.key ? { ...t, status: 'error' as const, error: msg } : t)),
        )
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
      textRef.current?.focus()
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
  const remaining = MAX_CHARS - text.length
  const nearLimit = remaining <= 200
  const reduced = prefersReducedMotion()

  return (
    <>
      <div
        className={cn(
          'bg-card rounded-2xl border transition-[border-color,box-shadow] duration-200',
          focused ? 'border-ring/50 shadow-ring/10 shadow-lg' : 'border-border',
          !connected && 'opacity-90',
        )}
      >
        {!connected ? (
          <div className="text-muted-foreground flex items-center gap-1.5 px-3 pt-2 text-[11px]">
            <span className="bg-warning size-1.5 shrink-0 animate-pulse rounded-full" aria-hidden="true" />
            Ligação instável — o envio vai tentar novamente.
          </div>
        ) : null}

        {tasks.length > 0 ? (
          <div className="feed-scroll flex max-h-[38dvh] flex-wrap content-start gap-1.5 px-2 pt-2">
            {tasks.map((task) => (
              <UploadChip
                key={task.key}
                task={task}
                active={activeKey === task.key}
                onRemove={removeTask}
                onRetry={retryTask}
              />
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

          <Tooltip>
            <TooltipTrigger>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground shrink-0 rounded-full"
                onClick={() => fileRef.current?.click()}
                aria-label="Anexar ficheiro"
              >
                <Icon name="plus" className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Anexar ficheiro</TooltipContent>
          </Tooltip>

          <div className="flex min-w-0 flex-1 flex-col">
            <textarea
              ref={textRef}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
              onPaste={onPaste}
              onKeyDown={onKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              rows={1}
              placeholder="Escreve uma mensagem…"
              aria-label="Mensagem"
              className="max-h-40 min-h-11 w-full min-w-0 resize-none bg-transparent py-2.5 text-[17px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
              style={{ fieldSizing: 'content' }}
            />
            {nearLimit ? (
              <div
                className={cn(
                  'text-right text-[11px] tabular-nums',
                  remaining <= 0 ? 'text-destructive font-medium' : 'text-muted-foreground',
                )}
              >
                {remaining <= 0 ? 'Limite atingido' : `${remaining} caracteres restantes`}
              </div>
            ) : null}
          </div>

          <Button
            type="submit"
            size="icon"
            disabled={!canSend}
            className={cn(
              'size-11 shrink-0 rounded-full transition-transform',
              canSend
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95'
                : 'bg-muted text-muted-foreground',
            )}
            aria-label="Enviar mensagem"
          >
            {sending ? <Spinner className="size-5" /> : <Icon name="send" className="size-5" />}
          </Button>
        </form>

        {/* dica de teclado — só em dispositivos com teclado físico */}
        <div className="text-muted-foreground/70 hidden items-center justify-end gap-1.5 px-3 pb-1.5 text-[11px] [@media(hover:hover)]:flex">
          <kbd className="bg-muted rounded border px-1 font-sans">Enter</kbd> envia
          <span aria-hidden="true">·</span>
          <kbd className="bg-muted rounded border px-1 font-sans">Shift</kbd>+
          <kbd className="bg-muted rounded border px-1 font-sans">Enter</kbd> nova linha
        </div>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>

      {dragDepth > 0 ? <DropOverlay reduced={reduced} count={tasks.length} /> : null}
    </>
  )
}

function DropOverlay({ reduced, count }: { reduced: boolean; count: number }) {
  return (
    <div className="bg-background/80 fixed inset-0 z-50 grid place-items-center p-6 backdrop-blur-sm">
      <div
        className={cn(
          'border-primary bg-card flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-10 py-10 text-center shadow-xl',
          !reduced && 'animate-dialog-in',
        )}
      >
        <span className="bg-primary/12 text-primary flex size-14 items-center justify-center rounded-2xl">
          <Icon name="upload" className="size-7" />
        </span>
        <p className="text-base font-semibold">Larga aqui os ficheiros</p>
        <p className="text-muted-foreground text-sm">
          {count > 0 ? `Vão ser adicionados aos ${count} que já estão na fila.` : 'Vão entrar na fila de envio.'}
        </p>
      </div>
    </div>
  )
}