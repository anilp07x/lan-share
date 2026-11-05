import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import { toast } from '../lib/toast.tsx'
import Icon from './Icon.tsx'
import type { Message, Sender } from '../types.ts'
import { errorMessage, isAuthError, postMessage, uploadFile } from '../api.ts'
import { cn } from '../lib/utils.ts'
import { formatBytes, messagePreview, PREVIEW_MAX_BYTES } from '../lib/format.ts'
import { getDevice } from '../lib/device.ts'
import { Button } from './ui/button.tsx'
import UploadChip, { type UploadTask } from './UploadChip.tsx'
import RecipientPicker, { recipientsLabel } from './RecipientPicker.tsx'

interface ComposerProps {
  connected: boolean
  maxFileMb?: number
  /** Outros dispositivos ligados (para enviar só a alguns). */
  peers: Sender[]
  replyTo: Message | null
  onCancelReply: () => void
  onMessage: (message: Message) => void
  onAuthFail: () => void
}

let taskKey = 0

export default function Composer({ connected, maxFileMb, peers, replyTo, onCancelReply, onMessage, onAuthFail }: ComposerProps) {
  const [text, setText] = useState('')
  const [recipients, setRecipients] = useState<Sender[]>([])
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const [activeKey, setActiveKey] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [dragDepth, setDragDepth] = useState(0)
  const [announce, setAnnounce] = useState('')
  const [launches, setLaunches] = useState(0)
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

  // escolher "responder" leva o cursor para a caixa de texto
  useEffect(() => {
    if (replyTo) textRef.current?.focus()
  }, [replyTo])

  function enqueueFiles(files: File[]) {
    if (files.length === 0) return
    // recusa logo o que o servidor recusaria, em vez de esperar pelo upload
    const limit = maxFileMb ? maxFileMb * 1024 * 1024 : Infinity
    const tooBig = files.filter((f) => f.size > limit)
    if (tooBig.length > 0) {
      toast.error(
        tooBig.length === 1
          ? `«${tooBig[0]!.name}» tem ${formatBytes(tooBig[0]!.size)}; o limite é ${maxFileMb} MB.`
          : `${tooBig.length} ficheiros passam o limite de ${maxFileMb} MB.`,
      )
      files = files.filter((f) => f.size <= limit)
      if (files.length === 0) return
    }
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
    setTasks((prev) => prev.map((t) => (t.key === next.key ? { ...t, status: 'uploading' as const, progress: 0 } : t)))
    const ac = new AbortController()
    abortRef.current = ac
    uploadFile(next.file, (p) => {
      setTasks((prev) => prev.map((t) => (t.key === next.key ? { ...t, progress: p.percent } : t)))
    }, ac.signal, getDevice(), next.to)
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
    setLaunches((n) => n + 1)
    const to = recipients.map((r) => r.id)
    if (tasks.length > 0) {
      // os destinatários ficam fixos no momento do envio, mesmo que mudem a seguir
      setTasks((prev) => prev.map((t) => (t.status === 'waiting' && !t.to ? { ...t, to } : t)))
      setProcessing(true)
    }
    if (!body) return
    setSending(true)
    try {
      const { message } = await postMessage(body, getDevice(), { to, replyTo: replyTo?.id })
      onMessage(message)
      setText('')
      onCancelReply()
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
    if (e.key === 'Escape' && replyTo) {
      e.preventDefault()
      onCancelReply()
      return
    }
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
      <div className="border-input bg-card focus-within:border-ring rounded-[22px] border shadow-[0_8px_24px_-16px_rgb(0_0_0/0.35)] transition-[border-color]">
        {!connected ? (
          <div className="tag text-warning flex items-center gap-1.5 px-4 pt-2.5 text-xs">
            <span className="bg-warning size-1.5 shrink-0 rounded-full" aria-hidden="true" />
            Sem ligação — os envios esperam pela rede
          </div>
        ) : null}

        {peers.length > 0 || recipients.length > 0 ? (
          <div className="flex items-center px-2 pt-1.5">
            <RecipientPicker peers={peers} value={recipients} onChange={setRecipients} />
          </div>
        ) : null}

        {replyTo ? (
          <div className="bg-muted/70 mx-2 mt-2 flex items-center gap-2 rounded-xl py-1.5 pr-1 pl-3">
            <Icon name="reply" className="text-muted-foreground size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="tag text-muted-foreground text-[11px]">A responder a {replyTo.from?.name ?? 'dispositivo sem nome'}</p>
              <p className="truncate text-sm">{messagePreview(replyTo)}</p>
            </div>
            <button
              type="button"
              onClick={onCancelReply}
              className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
              aria-label="Cancelar resposta"
            >
              <Icon name="x" className="size-4" />
            </button>
          </div>
        ) : null}

        {tasks.length > 0 ? (
          <div className="feed-scroll flex max-h-[38dvh] flex-wrap content-start gap-1.5 px-2 pt-2">
            {tasks.map((task) => (
              <UploadChip key={task.key} task={task} active={activeKey === task.key} onRemove={removeTask} onRetry={retryTask} />
            ))}
          </div>
        ) : null}

        <form onSubmit={(e) => void submit(e)} className="flex items-end gap-1 p-1.5">
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
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={onPaste}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={
              recipients.length > 0 ? `Mensagem só para ${recipientsLabel(recipients)}…` : 'Escreve ou cola algo para enviar…'
            }
            aria-label="Mensagem"
            className="placeholder:text-muted-foreground min-h-11 max-h-40 min-w-0 flex-1 resize-none place-self-center bg-transparent px-1 py-2.5 text-[16.5px] leading-relaxed outline-none"
            style={{ fieldSizing: 'content' }}
          />

          <Button
            type="submit"
            size="icon"
            disabled={!canSend}
            className={cn(
              'shrink-0 overflow-hidden rounded-full disabled:opacity-100',
              canSend ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
            aria-label={tasks.length > 0 ? 'Enviar tudo' : 'Enviar mensagem'}
            title="Enviar (Enter)"
          >
            {sending ? (
              <Icon name="loader" className="size-5 animate-spin" />
            ) : (
              <span key={launches} className={cn('flex', launches > 0 && 'animate-launch')}>
                <Icon name="send" className="size-5" />
              </span>
            )}
          </Button>
        </form>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>

      {dragDepth > 0 ? (
        <div className="bg-shell/85 animate-fade-in fixed inset-0 z-50 grid place-items-center p-6 backdrop-blur-[3px]">
          <div className="border-primary text-shell-foreground flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-12 py-10 text-center">
            <Icon name="capsule" className="text-primary size-10" />
            <p className="display text-[32px]">Larga para enviar</p>
            <p className="text-shell-muted text-sm">
              {recipients.length > 0 ? `Só para ${recipientsLabel(recipients)}` : 'Vai para todos os dispositivos ligados'}
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}