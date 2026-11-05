import Icon, { type IconName } from './Icon.tsx'
import type { FileMeta } from '../types.ts'
import { fileUrl } from '../api.ts'
import { cn } from '../lib/utils.ts'
import { formatBytes, formatExpiry, isPreviewable } from '../lib/format.ts'
import { Highlight } from './Linkify.tsx'

interface AttachmentKind {
  label: string
  icon: IconName
}

function attachmentKind(mime: string): AttachmentKind {
  if (mime.startsWith('image/')) return { label: 'Imagem', icon: 'image' }
  if (mime.startsWith('video/')) return { label: 'Vídeo', icon: 'video' }
  if (mime.startsWith('audio/')) return { label: 'Áudio', icon: 'audio' }
  if (mime === 'application/pdf') return { label: 'PDF', icon: 'file-text' }
  if (/zip|gzip|rar|7z|tar|x-7z|x-tar/.test(mime)) return { label: 'Arquivo', icon: 'archive' }
  // Office antes do texto: os tipos OOXML têm "xml" no nome mas não são código
  if (/spreadsheet|ms-excel/.test(mime)) return { label: 'Folha de cálculo', icon: 'file-text' }
  if (/presentation|ms-powerpoint/.test(mime)) return { label: 'Apresentação', icon: 'file-text' }
  if (/wordprocessing|msword|opendocument\.text/.test(mime)) return { label: 'Documento', icon: 'file-text' }
  if (mime.startsWith('text/') || /json|xml|javascript|typescript|csv/.test(mime)) {
    return { label: 'Documento', icon: 'code' }
  }
  return { label: 'Ficheiro', icon: 'file' }
}

interface AttachmentProps {
  file: FileMeta
  query?: string
  expiresAt?: number
  now: number
  onPreview: (file: FileMeta) => void
}

/** Conteúdo de uma cápsula de ficheiro: pré-visualização (imagens), ficha e descarga. */
export default function Attachment({ file, query, expiresAt, now, onPreview }: AttachmentProps) {
  const preview = isPreviewable(file)
  const { icon, label } = attachmentKind(file.mime)
  const expiry = expiresAt !== undefined ? formatExpiry(expiresAt, now) : null
  const expiringSoon = expiresAt !== undefined && expiresAt - now < 60 * 60_000

  return (
    <div className="flex flex-col">
      {preview ? (
        <button
          type="button"
          onClick={() => onPreview(file)}
          className="bg-muted group/preview relative block cursor-zoom-in overflow-hidden"
          aria-label={`Ver ${file.name}`}
        >
          <img
            src={fileUrl(file.fileId, true)}
            alt=""
            loading="lazy"
            className="h-36 w-full object-cover transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover/preview:scale-[1.03]"
          />
        </button>
      ) : null}

      <div className="flex items-center gap-2.5 py-2 pr-2 pl-3">
        <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Icon name={icon} className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={file.name}>
            <Highlight text={file.name} query={query} />
          </p>
          <p className="tag text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
            <span>{formatBytes(file.size)}</span>
            <span aria-hidden="true">·</span>
            <span>{label}</span>
            {expiry ? (
              <>
                <span aria-hidden="true">·</span>
                <span className={cn(expiringSoon && 'text-warning')}>{expiry}</span>
              </>
            ) : null}
          </p>
        </div>

        <a
          href={fileUrl(file.fileId)}
          download
          className="bg-foreground text-background hover:bg-foreground/85 flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors"
          aria-label={`Descarregar ${file.name}`}
          title="Descarregar"
        >
          <Icon name="download" className="size-4" />
        </a>
      </div>
    </div>
  )
}
