import Icon from './Icon.tsx'
import { formatBytes } from '../lib/format.ts'
import { cn } from '../lib/utils.ts'
import { Button } from './ui/button.tsx'

export type UploadStatus = 'waiting' | 'uploading' | 'done' | 'error'

export interface UploadTask {
  key: number
  file: File
  thumbUrl?: string
  progress: number
  status: UploadStatus
  error?: string
}

interface UploadChipProps {
  task: UploadTask
  active: boolean
  onRemove: (key: number) => void
  onRetry: (key: number) => void
}

export default function UploadChip({ task, active, onRemove, onRetry }: UploadChipProps) {
  const { file, status } = task

  return (
    <div
      data-chip="true"
      className={cn(
        'border-border bg-muted/50 flex w-full items-center gap-2.5 rounded-xl border p-1.5 sm:max-w-xs',
        active && 'border-ring/50',
        status === 'error' && 'border-destructive/60',
      )}
    >
      {task.thumbUrl ? (
        <img src={task.thumbUrl} alt="" className="bg-muted size-9 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon name={file.type.startsWith('image/') ? 'image' : 'file'} className="size-4" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-xs font-medium" title={file.name}>
            {file.name}
          </p>
          {status === 'uploading' ? (
            <span className="text-muted-foreground shrink-0 text-[11px]">{task.progress}%</span>
          ) : null}
          {status === 'error' ? <span className="text-destructive shrink-0 text-[11px]">Erro</span> : null}
          {status === 'done' ? <Icon name="check" className="text-success size-3.5 shrink-0" /> : null}
        </div>
        <p className="text-muted-foreground truncate text-[11px]">
          {formatBytes(file.size)}
          {status === 'error' && task.error ? ` · ${task.error}` : ''}
        </p>
        {status === 'uploading' ? (
          <div className="bg-muted mt-1 h-0.5 overflow-hidden rounded-full" aria-hidden="true">
            <div className="bg-primary h-full transition-[width] duration-200" style={{ width: `${task.progress}%` }} />
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {status === 'uploading' ? (
          <Icon name="loader" className="text-muted-foreground size-3.5 animate-spin" />
        ) : null}
        {status === 'error' ? (
          <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => onRetry(task.key)}>
            <Icon name="retry" className="size-3" />
            Reenviar
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          onClick={() => onRemove(task.key)}
          aria-label={status === 'uploading' ? 'Cancelar envio' : `Remover ${file.name}`}
        >
          <Icon name="x" className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}