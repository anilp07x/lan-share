import type { ComponentType } from 'react'
import {
  Archive,
  AudioLines,
  Download,
  ExternalLink,
  File,
  FileCode2,
  FileText,
  Image,
  Video,
  type LucideProps,
} from 'lucide-react'
import type { FileMeta } from '../types.ts'
import { fileUrl } from '../api.ts'
import { formatBytes, isPreviewable } from '../lib/format.ts'
import { cn } from '../lib/utils.ts'
import { Button } from './ui/button.tsx'
import { Badge } from './ui/badge.tsx'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.tsx'

interface AttachmentKind {
  label: string
  tint: string
  Icon: ComponentType<LucideProps>
}

function attachmentKind(mime: string): AttachmentKind {
  if (mime.startsWith('image/')) return { label: 'Imagem', tint: 'bg-primary/15 text-primary', Icon: Image }
  if (mime.startsWith('video/')) return { label: 'Vídeo', tint: 'bg-violet-500/15 text-violet-300', Icon: Video }
  if (mime.startsWith('audio/')) return { label: 'Áudio', tint: 'bg-emerald-500/15 text-emerald-300', Icon: AudioLines }
  if (mime === 'application/pdf') return { label: 'PDF', tint: 'bg-rose-500/15 text-rose-300', Icon: FileText }
  if (/zip|gzip|rar|7z|tar|x-7z|x-tar/.test(mime)) return { label: 'Arquivo', tint: 'bg-amber-500/15 text-amber-300', Icon: Archive }
  if (mime.startsWith('text/') || /json|xml|javascript|typescript|csv/.test(mime)) {
    return { label: 'Documento', tint: 'bg-sky-500/15 text-sky-300', Icon: FileCode2 }
  }
  return { label: 'Ficheiro', tint: 'bg-muted text-muted-foreground', Icon: File }
}

export default function Attachment({ file }: { file: FileMeta }) {
  const preview = isPreviewable(file)
  const downloadUrl = fileUrl(file.fileId)
  const previewUrl = fileUrl(file.fileId, true)
  const { tint, Icon, label } = attachmentKind(file.mime)

  return (
    <figure className="attachment-card group border-border bg-card overflow-hidden rounded-xl border shadow-sm">
      {preview ? (
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block bg-muted/40"
          aria-label={`Abrir ${file.name}`}
        >
          <img
            src={previewUrl}
            alt={file.name}
            loading="lazy"
            className="aspect-video w-full object-cover"
          />
          <div className="from-black/60 pointer-events-none absolute inset-0 bg-gradient-to-t to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          <Badge className="translate-y-1 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 absolute right-2.5 bottom-2.5 gap-1">
            <ExternalLink className="size-3" />
            Ver
          </Badge>
        </a>
      ) : null}

      <div className="flex items-center gap-3 p-3">
        <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', tint)}>
          <Icon className="size-5" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={file.name}>
            {file.name}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{formatBytes(file.size)}</span>
            <span aria-hidden="true">·</span>
            <span>{label}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-9" asChild>
                <a href={downloadUrl} download aria-label={`Descarregar ${file.name}`}>
                  <Download className="size-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Descarregar</TooltipContent>
          </Tooltip>

          {preview ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9" asChild>
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${file.name}`}>
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Abrir</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>
    </figure>
  )
}