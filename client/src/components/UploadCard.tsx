import { formatBytes } from '../lib/format.ts'

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

export default function UploadCard({ task, active, onCancel, onRetry }: UploadCardProps) {
  const { file, status } = task

  return (
    <div className={`upload-card status-${status}`}>
      <div className="upload-name" title={file.name}>
        {file.name}
      </div>
      <div className="upload-detail">
        {formatBytes(file.size)}
        {' · '}
        {status === 'waiting' && 'Em espera'}
        {status === 'uploading' && `${task.progress}%`}
        {status === 'done' && 'Enviado'}
        {status === 'error' && (task.error ?? 'Erro ao enviar.')}
      </div>

      {status === 'uploading' ? (
        <>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${task.progress}%` }} />
          </div>
          <div className="upload-actions">
            <button type="button" className="btn btn-ghost btn-small" onClick={() => onCancel(task.key)}>
              Cancelar
            </button>
          </div>
        </>
      ) : null}

      {status === 'waiting' && !active ? (
        <div className="upload-actions">
          <button type="button" className="btn btn-ghost btn-small" onClick={() => onCancel(task.key)}>
            Cancelar
          </button>
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="upload-actions">
          <button type="button" className="btn btn-ghost btn-small" onClick={() => onCancel(task.key)}>
            Fechar
          </button>
          <button type="button" className="btn btn-primary btn-small" onClick={() => onRetry(task.key)}>
            Reenviar
          </button>
        </div>
      ) : null}
    </div>
  )
}