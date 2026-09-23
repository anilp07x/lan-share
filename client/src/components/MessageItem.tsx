import { useState } from 'react'
import type { FileMessage, Message } from '../types.ts'
import { fileUrl } from '../api.ts'
import { copyText, formatBytes, formatTime, isPreviewable } from '../lib/format.ts'

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 20h14v-2H5v2zm7-18H5v2h14V2h-7zm-5 8h4v6h2v-6h4l-5-5-5 5z" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z" />
    </svg>
  )
}

function isFile(m: Message): m is FileMessage {
  return m.kind === 'file'
}

export default function MessageItem({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    if (message.kind !== 'text') return
    const ok = await copyText(message.body)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  if (message.kind === 'text') {
    return (
      <div className="msg msg-text">
        <div className="bubble">
          <div className="bubble-body">{message.body}</div>
          <div className="bubble-meta">
            <span className="bubble-time">{formatTime(message.ts)}</span>
            <button type="button" className="icon-btn" onClick={onCopy} title="Copiar texto">
              <CopyIcon />
              <span className="icon-btn-label">{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  const file = message.file
  const preview = isPreviewable(file)
  const url = fileUrl(file.fileId)
  const previewUrl = fileUrl(file.fileId, true)

  return (
    <div className="msg msg-file">
      <div className="file-card">
        {preview ? (
          <a className="file-thumb" href={previewUrl} target="_blank" rel="noopener noreferrer">
            <img src={previewUrl} alt={file.name} loading="lazy" />
          </a>
        ) : null}
        <div className="file-info">
          <FileIcon />
          <div className="file-meta">
            <span className="file-name" title={file.name}>
              {file.name}
            </span>
            <span className="file-detail">
              {formatBytes(file.size)}
              {preview ? '' : ` · ${file.mime}`}
            </span>
          </div>
        </div>
        <div className="file-actions">
          <span className="bubble-time">{formatTime(message.ts)}</span>
          <a className="btn btn-primary btn-small" href={url}>
            <DownloadIcon /> Descarregar
          </a>
        </div>
      </div>
    </div>
  )
}