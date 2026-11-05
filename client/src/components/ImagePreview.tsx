import Icon from './Icon.tsx'
import type { FileMeta } from '../types.ts'
import { fileUrl } from '../api.ts'
import { formatBytes } from '../lib/format.ts'
import { Button } from './ui/button.tsx'
import { Dialog, DialogClose, DialogContent, DialogTitle } from './ui/dialog.tsx'

export interface PreviewState {
  items: FileMeta[]
  index: number
}

interface ImagePreviewProps {
  preview: PreviewState | null
  onChange: (preview: PreviewState | null) => void
}

/** Visualizador de imagem em ecrã quase inteiro; num álbum navega com setas. */
export default function ImagePreview({ preview, onChange }: ImagePreviewProps) {
  const file = preview ? preview.items[preview.index] : undefined
  const total = preview?.items.length ?? 0
  const go = (step: number) => {
    if (!preview || total < 2) return
    onChange({ ...preview, index: (preview.index + step + total) % total })
  }

  return (
    <Dialog open={file !== undefined} onOpenChange={(open) => !open && onChange(null)}>
      {file ? (
        <DialogContent
          className="flex max-w-[min(94vw,1000px)] flex-col gap-4 p-3 pt-14 sm:p-4 sm:pt-14"
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') go(-1)
            else if (e.key === 'ArrowRight') go(1)
          }}
        >
          <DialogTitle className="absolute top-4 right-16 left-5 truncate text-base">{file.name}</DialogTitle>
          <div className="relative">
            <img
              src={fileUrl(file.fileId, true)}
              alt={file.name}
              className="bg-muted mx-auto max-h-[68dvh] w-auto max-w-full rounded-lg object-contain"
            />
            {total > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="absolute top-1/2 left-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                  aria-label="Imagem anterior"
                >
                  <Icon name="chevron-left" className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                  aria-label="Imagem seguinte"
                >
                  <Icon name="chevron-right" className="size-5" />
                </button>
              </>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="tag text-muted-foreground text-xs">
              {total > 1 ? `${(preview?.index ?? 0) + 1} de ${total} · ` : ''}
              {formatBytes(file.size)}
            </span>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Fechar</Button>
              </DialogClose>
              <Button asChild>
                <a href={fileUrl(file.fileId)} download>
                  <Icon name="download" className="size-4" />
                  Descarregar
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
