import Icon from './Icon.tsx'
import { formatBytes } from '../lib/format.ts'
import { Button } from './ui/button.tsx'
import { Progress } from './ui/progress.tsx'
import { Spinner } from './ui/spinner.tsx'
import {
  Attachment,
  AttachmentActions,
  AttachmentAction,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from './ui/attachment.tsx'

export type UploadStatus = 'waiting' | 'uploading' | 'done' | 'error'

export interface UploadTask {
  key: number
  file: File
  thumbUrl?: string
  progress: number
  status: UploadStatus
  error?: string
}

/** O UploadStatus mapeia directamente nos estados do Attachment. */
const attachmentState = {
  waiting: 'idle',
  uploading: 'uploading',
  done: 'done',
  error: 'error',
} as const satisfies Record<UploadStatus, 'idle' | 'uploading' | 'processing' | 'error' | 'done'>

interface UploadChipProps {
  task: UploadTask
  active: boolean
  onRemove: (key: number) => void
  onRetry: (key: number) => void
}

export default function UploadChip({ task, active, onRemove, onRetry }: UploadChipProps) {
  const { file, status } = task

  const meta =
    status === 'error' && task.error
      ? `${formatBytes(file.size)} · ${task.error}`
      : status === 'waiting'
        ? `${formatBytes(file.size)} · na fila`
        : status === 'done'
          ? `${formatBytes(file.size)} · enviado`
          : formatBytes(file.size)

  return (
    <Attachment
      state={attachmentState[status]}
      size="sm"
      data-chip="true"
      className="w-full focus-within:ring-ring/50 focus-within:ring-1 sm:max-w-xs"
    >
      {task.thumbUrl ? (
        <AttachmentMedia variant="image">
          <img src={task.thumbUrl} alt="" />
        </AttachmentMedia>
      ) : (
        <AttachmentMedia>
          <Icon name={file.type.startsWith('image/') ? 'image' : 'file'} className="size-4" />
        </AttachmentMedia>
      )}

      <AttachmentContent>
        <div className="flex min-w-0 items-center gap-1.5">
          {/* nos estados uploading/processing o título ganha o shimmer do primitivo */}
          <AttachmentTitle title={file.name}>{file.name}</AttachmentTitle>
          {status === 'uploading' ? (
            <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">{task.progress}%</span>
          ) : null}
          {status === 'done' ? <Icon name="check" className="text-success size-3.5 shrink-0" /> : null}
        </div>

        <AttachmentDescription>{meta}</AttachmentDescription>

        {status === 'uploading' ? (
          <Progress
            value={task.progress}
            className={task.progress === 0 ? 'animate-pulse' : undefined}
            aria-label={`A enviar ${file.name}`}
          />
        ) : null}
      </AttachmentContent>

      <AttachmentActions className="gap-0.5">
        {status === 'uploading' ? <Spinner className="text-muted-foreground size-3.5" /> : null}
        {status === 'error' ? (
          <Button variant="outline" size="xs" className="gap-1 px-2 text-[11px]" onClick={() => onRetry(task.key)}>
            <Icon name="retry" className="size-3" />
            Reenviar
          </Button>
        ) : null}
        <AttachmentAction
          size="icon-sm"
          title={status === 'uploading' ? 'Cancelar envio' : `Remover ${file.name}`}
          aria-label={status === 'uploading' ? 'Cancelar envio' : `Remover ${file.name}`}
          onClick={() => onRemove(task.key)}
        >
          <Icon name="x" className="size-3.5" />
        </AttachmentAction>
      </AttachmentActions>

      {active ? <span className="sr-only">A enviar agora</span> : null}
    </Attachment>
  )
}
