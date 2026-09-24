import { useState } from 'react'
import Icon, { type IconName } from './Icon.tsx'
import type { FileMeta } from '../types.ts'
import { fileUrl } from '../api.ts'
import { cn } from '../lib/utils.ts'
import { isPreviewable, formatBytes } from '../lib/format.ts'
import { Badge } from './ui/badge.tsx'
import { Button } from './ui/button.tsx'
import { Dialog, DialogClose, DialogContent, DialogTitle } from './ui/dialog.tsx'

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
  if (mime.startsWith('text/') || /json|xml|javascript|typescript|csv/.test(mime)) {
    return { label: 'Documento', icon: 'code' }
  }
  return { label: 'Ficheiro', icon: 'file' }
}

export default function Attachment({ file }: { file: FileMeta }) {
  const [open, setOpen] = useState(false)
  const preview = isPreviewable(file)
  const downloadUrl = fileUrl(file.fileId)
  const previewUrl = fileUrl(file.fileId, true)
  const { icon: kindIcon, label } = attachmentKind(file.mime)
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
              <Icon name="expand" className="size-3" />
              Ver
            </Badge>
          </button> 
        ) : null} 

        <div className="flex items-center gap-3 p-3">
          <div className={cn('bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-xl')}>
            <Icon name={kindIcon} className="size-5" />
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
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              title="Descarregar"
              aria-label={`Descarregar ${file.name}`}
              asChild
            >
              <a href={downloadUrl} download>
                <Icon name="download" className="size-4" />
              </a>
            </Button>

            {preview ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                title="Abrir"
                onClick={openPreview}
                aria-label={`Abrir ${file.name}`}
              >
                <Icon name="expand" className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </figure>

      <DialogContent className="border-border bg-card max-w-[min(92vw,920px)] gap-4 overflow-y-auto border p-4 pt-10 shadow-none sm:max-w-[92vw]">
        <DialogTitle className="sr-only">{file.name}</DialogTitle>
        <img src={previewUrl} alt={file.name} className="mx-auto max-h-[60dvh] w-auto max-w-full rounded-lg object-contain" />
        <div className="flex items-center justify-center gap-2 pb-1">
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={downloadUrl} download>
              <Icon name="download" className="size-3.5" />
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