import { useState, type ComponentType } from 'react'
import {
  Archive,
  AudioLines,
  Download,
  Expand,
  File,
  FileCode2,
  FileText,
  Image,
  Video,
  type LucideProps,
} from 'lucide-react'
import type { FileMeta } from '../types.ts'
import { fileUrl } from '../api.ts'
import { cn } from '../lib/utils.ts'
import { isPreviewable, formatBytes } from '../lib/format.ts'
import { Badge } from './ui/badge.tsx'
import { Button } from './ui/button.tsx'
import { Dialog, DialogClose, DialogContent, DialogTitle } from './ui/dialog.tsx'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.tsx'

interface AttachmentKind {
  label: string
  Icon: ComponentType<LucideProps>
}

function attachmentKind(mime: string): AttachmentKind {
  if (mime.startsWith('image/')) return { label: 'Imagem', Icon: Image }
  if (mime.startsWith('video/')) return { label: 'Vídeo', Icon: Video }
  if (mime.startsWith('audio/')) return { label: 'Áudio', Icon: AudioLines }
  if (mime === 'application/pdf') return { label: 'PDF', Icon: FileText }
  if (/zip|gzip|rar|7z|tar|x-7z|x-tar/.test(mime)) return { label: 'Arquivo', Icon: Archive }
  if (mime.startsWith('text/') || /json|xml|javascript|typescript|csv/.test(mime)) {
    return { label: 'Documento', Icon: FileCode2 }
  }
  return { label: 'Ficheiro', Icon: File }
}

export default function Attachment({ file }: { file: FileMeta }) {
  const [open, setOpen] = useState(false)
  const preview = isPreviewable(file)
  const downloadUrl = fileUrl(file.fileId)
  const previewUrl = fileUrl(file.fileId, true)
  const { Icon, label } = attachmentKind(file.mime)
  const openPreview = () => setOpen(true)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <figure className="attachment-card group border-border bg-card overflow-hidden rounded-xl border">
        {preview ? (
          <button
            type="button"
            onClick={openPreview}
            className="bg-muted/40 relative block w-full cursor-zoom-in text-left"
            aria-label={`Ver ${file.name}`}
          >
            <img src={previewUrl} alt={file.name} loading="lazy" className="aspect-video w-full object-cover" />
            <div className="from-black/50 pointer-events-none absolute inset-0 bg-gradient-to-t to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <Badge
              className="bg-background/85 text-muted-foreground translate-y-1 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 absolute right-2.5 bottom-2.5 gap-1"
              variant="outline"
            >
              <Expand className="size-3" />
              Ver
            </Badge>
          </button>
        ) : null}

        <div className="flex items-center gap-3 p-3">
          <div className={cn('bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-xl')}>
            <Icon className="size-5" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={file.name}>
              {file.name}
            </p>
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
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
                  <Button variant="ghost" size="icon" className="size-9" onClick={openPreview} aria-label={`Abrir ${file.name}`}>
                    <Expand className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Abrir</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </div>
      </figure>

      <DialogContent className="border-border bg-card max-w-[min(92vw,920px)] gap-4 border p-4 shadow-none">
        <DialogTitle className="sr-only">{file.name}</DialogTitle>
        <img src={previewUrl} alt={file.name} className="max-h-[70vh] w-full rounded-lg object-contain" />
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={downloadUrl} download>
              <Download className="size-3.5" />
              Descarregar
            </a>
          </Button>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Fechar
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}