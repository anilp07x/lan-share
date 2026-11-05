import type { FileMessage, FileMeta } from '../types.ts'
import { fileUrl } from '../api.ts'
import { formatTime, isPreviewable } from '../lib/format.ts'
import Icon from './Icon.tsx'

interface GalleryProps {
  items: FileMessage[]
  selfId: string
  onPreview: (files: FileMeta[], index: number) => void
}

/** Grelha de imagens, mais recentes primeiro. */
export default function Gallery({ items, selfId, onPreview }: GalleryProps) {
  const ordered = [...items].reverse()
  const previewable = ordered.map((m) => m.file).filter(isPreviewable)
  return (
    <ul className="grid grid-cols-3 gap-1.5 py-4 sm:grid-cols-4 lg:grid-cols-5">
      {ordered.map((m) => {
        const mine = m.from?.id === selfId
        return (
          <li key={m.id}>
            {isPreviewable(m.file) ? (
              <button
                type="button"
                onClick={() => onPreview(previewable, previewable.indexOf(m.file))}
                className="group bg-muted relative block aspect-square w-full overflow-hidden rounded-xl"
                aria-label={`Ver ${m.file.name}`}
              >
                <img
                  src={fileUrl(m.file.fileId, true)}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.04]"
                />
                <span className="tag absolute inset-x-1.5 bottom-1.5 flex items-center gap-1.5 truncate rounded-lg bg-black/55 px-2 py-1 text-[11px] text-white backdrop-blur-sm">
                  <span className="min-w-0 flex-1 truncate text-left">{mine ? 'Eu' : (m.from?.name ?? 'Sem nome')}</span>
                  <time>{formatTime(m.ts)}</time>
                </span>
              </button>
            ) : (
              <a
                href={fileUrl(m.file.fileId)}
                download
                className="bg-muted text-muted-foreground flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl p-3 text-center"
              >
                <Icon name="image" className="size-6" />
                <span className="line-clamp-2 text-xs break-all">{m.file.name}</span>
                <span className="tag text-[11px]">Grande demais · descarregar</span>
              </a>
            )}
          </li>
        )
      })}
    </ul>
  )
}
