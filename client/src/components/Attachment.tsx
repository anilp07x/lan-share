import { useState } from 'react'
import Icon, { type IconName } from './Icon.tsx'
import type { FileMeta } from '../types.ts'
import { fileUrl } from '../api.ts'
import { cn } from '../lib/utils.ts'
import { isPreviewable, formatBytes } from '../lib/format.ts'
import { Badge } from './ui/badge.tsx'
import { Button } from './ui/button.tsx'
import { Skeleton } from './ui/skeleton.tsx'
import {
  Attachment as AttachmentPrimitive,
  AttachmentActions,
  AttachmentAction,
  AttachmentMedia,
  AttachmentTrigger,
} from './ui/attachment.tsx'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog.tsx'

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

/** O que o browser consegue mostrar inline sem depender do tipo de ficheiro. */
type PreviewKind = 'image' | 'video' | 'audio' | 'none'

function previewKind(file: FileMeta): PreviewKind {
  // isPreviewable também protege contra imagens gigantes (limite de 20 MB)
  if (isPreviewable(file)) return 'image'
  if (file.mime.startsWith('image/')) return 'none'
  if (file.mime.startsWith('video/')) return 'video'
  if (file.mime.startsWith('audio/')) return 'audio'
  return 'none'
}

export default function Attachment({ file }: { file: FileMeta }) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  const kind = previewKind(file)
  const canPreview = kind !== 'none'
  const downloadUrl = fileUrl(file.fileId)
  const streamUrl = fileUrl(file.fileId, true)
  const { icon: kindIcon, label } = attachmentKind(file.mime)

  const showSkeleton = canPreview && !loaded && !failed

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <AttachmentPrimitive
        state={failed ? 'error' : 'done'}
        orientation={canPreview ? 'vertical' : 'horizontal'}
        className={cn(
          'max-w-full overflow-hidden',
          canPreview ? 'w-[min(100%,420px)]' : 'w-[min(100%,360px)]',
        )}
      >
        {/* ── preview ─────────────────────────────────────────────── */}
        {canPreview ? (
          <AttachmentMedia
            variant="image"
            className="group/preview bg-muted/40 aspect-video w-full rounded-none"
          >
            {failed ? (
              /* fallback: o browser não conseguiu descodificar */
              <div className="flex h-full w-full flex-col items-center justify-center gap-1.5">
                <Icon name="alert-circle" className="text-muted-foreground size-6" />
                <span className="text-muted-foreground text-xs">Pré-visualização indisponível</span>
              </div>
            ) : (
              <>
                {showSkeleton ? <Skeleton className="aspect-video w-full rounded-none" /> : null}

                {kind === 'image' ? (
                  <img
                    src={streamUrl}
                    alt={file.name}
                    loading="lazy"
                    decoding="async"
                    onLoad={() => setLoaded(true)}
                    onError={() => setFailed(true)}
                    className={cn(
                      'aspect-video w-full object-cover transition-opacity duration-300',
                      loaded ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                ) : null}

                {kind === 'video' ? (
                  <video
                    src={streamUrl}
                    preload="metadata"
                    playsInline
                    controls
                    onLoadedData={() => setLoaded(true)}
                    onError={() => setFailed(true)}
                    className={cn(
                      'aspect-video w-full bg-black object-contain transition-opacity duration-300',
                      loaded ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                ) : null}

                {kind === 'audio' ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-6">
                    <span className="bg-primary/12 text-primary flex size-14 items-center justify-center rounded-full">
                      <Icon name="audio" className="size-6" />
                    </span>
                    <audio
                      src={streamUrl}
                      preload="metadata"
                      controls
                      onLoadedData={() => setLoaded(true)}
                      onError={() => setFailed(true)}
                      className="h-9 w-full max-w-sm"
                    />
                  </div>
                ) : null}

                {/* dica de zoom só nas imagens */}
                {kind === 'image' && !failed ? (
                  <>
                    <AttachmentTrigger
                      className="cursor-zoom-in"
                      aria-label={`Ampliar ${file.name}`}
                      onClick={() => setOpen(true)}
                    />
                    <Badge
                      className="bg-background/85 text-muted-foreground pointer-events-none absolute right-2.5 bottom-2.5 translate-y-1 gap-1 opacity-0 backdrop-blur transition-all duration-200 group-hover/preview:translate-y-0 group-hover/preview:opacity-100"
                      variant="outline"
                    >
                      <Icon name="expand" className="size-3" />
                      Ampliar
                    </Badge>
                  </>
                ) : null}
              </>
            )}
          </AttachmentMedia>
        ) : null}

        {/* ── metadados ──────────────────────────────────────────── */}
        <div className="flex items-center gap-3 p-2.5">
          {!canPreview ? (
            <AttachmentMedia>
              <Icon name={failed ? 'alert-circle' : kindIcon} className="size-5" />
            </AttachmentMedia>
          ) : null}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={file.name}>
              {file.name}
            </p>
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span className="tabular-nums">{formatBytes(file.size)}</span>
              <span aria-hidden="true">·</span>
              <span>{failed ? 'Não pré-visualizável' : label}</span>
            </p>
          </div>

          <AttachmentActions>
            {canPreview && !failed ? (
              <AttachmentAction
                variant="secondary"
                size="icon-sm"
                title="Ampliar"
                aria-label={`Ampliar ${file.name}`}
                onClick={() => setOpen(true)}
              >
                <Icon name="expand" className="size-4" />
              </AttachmentAction>
            ) : null}

            <AttachmentAction
              variant="secondary"
              size="icon-sm"
              title="Descarregar"
              aria-label={`Descarregar ${file.name}`}
              asChild
            >
              <a href={downloadUrl} download>
                <Icon name="download" className="size-4" />
              </a>
            </AttachmentAction>
          </AttachmentActions>
        </div>
      </AttachmentPrimitive>

      {/* ── lightbox ─────────────────────────────────────────────── */}
      <DialogContent className="border-border bg-card max-w-[min(94vw,960px)] overflow-hidden border p-0 shadow-none sm:max-w-[94vw]">
        <DialogHeader className="gap-1 px-4 pt-4">
          <DialogTitle className="truncate pr-8 text-sm" title={file.name}>
            {file.name}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-xs">
            <span className="tabular-nums">{formatBytes(file.size)}</span>
            <span aria-hidden="true">·</span>
            <span>{label}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 flex max-h-[68dvh] items-center justify-center overflow-auto p-3">
          {kind === 'image' ? (
            <img
              src={streamUrl}
              alt={file.name}
              className="max-h-[62dvh] w-auto max-w-full rounded-lg object-contain"
            />
          ) : null}
          {kind === 'video' ? (
            <video src={streamUrl} controls autoPlay playsInline className="max-h-[62dvh] w-auto max-w-full rounded-lg">
              O teu navegador não suporta este vídeo.
            </video>
          ) : null}
          {kind === 'audio' ? (
            <audio src={streamUrl} controls autoPlay className="w-full max-w-md">
              O teu navegador não suporta este áudio.
            </audio>
          ) : null}
        </div>

        <div className="flex items-center justify-center gap-2 p-3 pt-1">
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
