import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { Check, File, ImageIcon, RotateCcw, X } from 'lucide-react'
import { formatBytes } from '../lib/format.ts'
import { prefersReducedMotion } from '../lib/motion.ts'
import { cn } from '../lib/utils.ts'
import { Button } from './ui/button.tsx'
import { Progress } from './ui/progress.tsx'

export type UploadStatus = 'waiting' | 'uploading' | 'done' | 'error'

export interface UploadTask {
  key: number
  file: File
  progress: number
  status: UploadStatus
  error?: string
}

interface UploadCardProps {
  task: UploadTask
  active: boolean
  onCancel: (key: number) => void
  onRetry: (key: number) => void
}

const statusLabel: Record<UploadStatus, string> = {
  waiting: 'Em espera',
  uploading: 'A enviar',
  done: 'Enviado',
  error: 'Erro',
}

export default function UploadCard({ task, active, onCancel, onRetry }: UploadCardProps) {
  const { file, status } = task
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const anim = gsap.fromTo(el, { opacity: 0, y: -8, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'power2.out' })
    return () => {
      anim.kill()
    }
  }, [])

  const isImage = file.type.startsWith('image/')

  return (
    <div
      ref={ref}
      className={cn(
        'border-border bg-card flex items-center gap-3 rounded-xl border px-3 py-2.5',
        status === 'error' && 'border-destructive/60',
      )}
    >
      <div className={cn('bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg', status === 'done' && 'text-success')}>
        {status === 'done' ? <Check className="size-4" /> : isImage ? <ImageIcon className="size-4" /> : <File className="size-4" />}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium" title={file.name}>
            {file.name}
          </p>
          <span className={cn('shrink-0 text-xs', status === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
            {statusLabel[status]}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          {formatBytes(file.size)}
          {status === 'uploading' ? ` · ${task.progress}%` : ''}
          {status === 'error' && task.error ? ` · ${task.error}` : ''}
        </p>
        {status === 'uploading' ? <Progress value={task.progress} className="h-1" /> : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {status !== 'done' && !(status === 'waiting' && active) ? (
          <Button variant="ghost" size="icon" className="size-8" onClick={() => onCancel(task.key)} aria-label={status === 'uploading' ? 'Cancelar envio' : 'Remover'}>
            <X className="size-4" />
          </Button>
        ) : null}
        {status === 'error' ? (
          <Button variant="outline" size="sm" className="gap-1" onClick={() => onRetry(task.key)}>
            <RotateCcw className="size-3.5" />
            Reenviar
          </Button>
        ) : null}
      </div>
    </div>
  )
}