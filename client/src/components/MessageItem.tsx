import type { ReactNode } from 'react'
import Icon, { type IconName } from './Icon.tsx'
import type { FileMessage, FileMeta, Message, Sender } from '../types.ts'
import { fileUrl } from '../api.ts'
import { formatBytes, formatExpiry, formatTime, messagePreview } from '../lib/format.ts'
import { senderHue } from '../lib/device.ts'
import { useCopied } from '../hooks/useCopied.ts'
import { cn } from '../lib/utils.ts'
import Attachment from './Attachment.tsx'
import Linkify from './Linkify.tsx'

/** Ações comuns a todas as cápsulas. */
export interface CapsuleActions {
  onReply: (message: Message) => void
  onDelete: (messages: Message[]) => void
  onJump: (id: string) => void
}

function TagButton({ icon, label, onClick, className }: { icon: IconName; label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-muted-foreground hover:bg-accent hover:text-foreground -my-1 flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors',
        className,
      )}
      aria-label={label}
      title={label}
    >
      <Icon name={icon} className="size-3.5" />
    </button>
  )
}

/** "Ana → ti" / "eu → Rui": a quem foi um envio privado. */
function recipientsText(to: Sender[], selfId: string): string {
  return to.map((r) => (r.id === selfId ? 'ti' : r.name)).join(', ')
}

interface CapsuleProps {
  message: Message
  mine: boolean
  selfId: string
  wide: boolean
  label?: string
  actions: ReactNode
  children: ReactNode
}

/**
 * Cápsula: guia de expedição (remetente · hora) separada do conteúdo por
 * uma linha picotada. As minhas vão à direita, com guia âmbar.
 */
function Capsule({ message, mine, selfId, wide, label, actions, children }: CapsuleProps) {
  const { from, ts, to } = message
  const sender = from?.name ?? 'Dispositivo sem nome'
  const dot = mine ? 'var(--primary)' : from ? senderHue(from.id) : 'var(--muted-foreground)'
  const toText = to ? recipientsText(to, selfId) : null

  return (
    <article
      id={`msg-${message.id}`}
      className={cn(
        'flex w-fit min-w-[min(100%,15rem)] scroll-my-24 flex-col overflow-hidden rounded-2xl border',
        wide ? 'max-w-[min(100%,34rem)]' : 'w-full max-w-[min(100%,20rem)]',
        mine ? 'border-primary/45 bg-card self-end' : 'border-border bg-card self-start',
      )}
      aria-label={[
        label,
        mine ? 'enviado por mim' : `de ${sender}`,
        toText ? `só para ${toText}` : null,
        formatTime(ts),
      ]
        .filter(Boolean)
        .join(', ')}
    >
      <header
        data-tag
        className={cn(
          'perforated flex min-h-9 items-center gap-2 py-1.5 pr-1.5 pl-3.5',
          mine ? 'bg-signal-wash' : 'bg-muted/70',
        )}
      >
        <span className="size-2 shrink-0 rounded-full" style={{ background: dot }} aria-hidden="true" />
        <span className={cn('tag min-w-0 flex-1 truncate text-xs', mine ? 'text-signal-ink' : 'text-muted-foreground')}>
          {mine ? `${sender} · eu` : sender}
          {toText ? (
            <>
              {' '}
              <Icon name="lock" className="mb-px inline size-3" /> {toText}
            </>
          ) : null}
        </span>
        <time className="tag text-muted-foreground text-xs" dateTime={new Date(ts).toISOString()}>
          {formatTime(ts)}
        </time>
        <span className="flex items-center">{actions}</span>
      </header>
      {children}
    </article>
  )
}

function Quote({ quoted, onJump }: { quoted: Message | null; onJump: (id: string) => void }) {
  if (!quoted) {
    return (
      <p className="bg-muted/60 text-muted-foreground mx-2.5 mt-2.5 rounded-lg px-2.5 py-1.5 text-sm">
        Envio citado já não está disponível
      </p>
    )
  }
  return (
    <button
      type="button"
      onClick={() => onJump(quoted.id)}
      className="bg-muted/60 hover:bg-muted mx-2.5 mt-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors"
      aria-label={`Ver envio citado de ${quoted.from?.name ?? 'dispositivo sem nome'}`}
    >
      <span className="tag text-muted-foreground flex items-center gap-1 text-[11px]">
        <Icon name="reply" className="size-3" />
        {quoted.from?.name ?? 'Dispositivo sem nome'}
      </span>
      <span className="line-clamp-2 text-sm break-words">{messagePreview(quoted)}</span>
    </button>
  )
}

interface MessageItemProps extends CapsuleActions {
  message: Message
  mine: boolean
  selfId: string
  /** Mensagem citada; null se já não existir; undefined se não for resposta. */
  quoted?: Message | null
  query?: string
  expiresAt?: number
  now: number
  onPreview: (file: FileMeta) => void
}

export default function MessageItem({
  message,
  mine,
  selfId,
  quoted,
  query,
  expiresAt,
  now,
  onPreview,
  onReply,
  onDelete,
  onJump,
}: MessageItemProps) {
  const { copied, copy } = useCopied()

  return (
    <Capsule
      message={message}
      mine={mine}
      selfId={selfId}
      wide={message.kind === 'text'}
      actions={
        <>
          <TagButton icon="reply" label="Responder" onClick={() => onReply(message)} />
          {message.kind === 'text' ? (
            <TagButton
              icon={copied ? 'check' : 'copy'}
              label={copied ? 'Texto copiado' : 'Copiar texto'}
              onClick={() => void copy(message.body)}
              className={copied ? 'text-success' : undefined}
            />
          ) : null}
          {mine ? <TagButton icon="trash" label="Apagar para todos" onClick={() => onDelete([message])} /> : null}
        </>
      }
    >
      {quoted !== undefined ? <Quote quoted={quoted} onJump={onJump} /> : null}
      {message.kind === 'text' ? (
        <p className="px-3.5 pt-2.5 pb-3 text-[16.5px] leading-relaxed break-words whitespace-pre-wrap">
          <Linkify text={message.body} query={query} />
        </p>
      ) : (
        <Attachment file={message.file} query={query} expiresAt={expiresAt} now={now} onPreview={onPreview} />
      )}
    </Capsule>
  )
}

const ALBUM_TILES = 4

interface AlbumItemProps extends CapsuleActions {
  messages: [FileMessage, ...FileMessage[]]
  mine: boolean
  selfId: string
  expiresAt?: number
  now: number
  onPreview: (files: FileMeta[], index: number) => void
}

/** Várias imagens seguidas do mesmo remetente numa só cápsula, em grelha. */
export function AlbumItem({ messages, mine, selfId, expiresAt, now, onPreview, onReply, onDelete }: AlbumItemProps) {
  const files = messages.map((m) => m.file)
  const last = messages.at(-1) ?? messages[0]
  const total = files.reduce((sum, f) => sum + f.size, 0)
  const shown = files.slice(0, ALBUM_TILES)
  const hidden = files.length - ALBUM_TILES
  const expiry = expiresAt !== undefined ? formatExpiry(expiresAt, now) : null
  const expiringSoon = expiresAt !== undefined && expiresAt - now < 60 * 60_000

  // descarrega um a um: o browser não aceita vários ficheiros num só clique
  const downloadAll = () => {
    files.forEach((f, i) => {
      setTimeout(() => {
        const a = document.createElement('a')
        a.href = fileUrl(f.fileId)
        a.download = f.name
        a.click()
      }, i * 300)
    })
  }

  return (
    <Capsule
      message={last}
      mine={mine}
      selfId={selfId}
      wide={false}
      label={`${files.length} imagens`}
      actions={
        <>
          <TagButton icon="reply" label="Responder" onClick={() => onReply(last)} />
          {mine ? <TagButton icon="trash" label="Apagar álbum para todos" onClick={() => onDelete(messages)} /> : null}
        </>
      }
    >
      <div className="grid grid-cols-2 gap-0.5">
        {shown.map((file, i) => {
          const more = i === ALBUM_TILES - 1 && hidden > 0
          return (
            <button
              key={file.fileId}
              type="button"
              onClick={() => onPreview(files, i)}
              className={cn(
                'bg-muted group/tile relative block cursor-zoom-in overflow-hidden',
                shown.length === 3 && i === 0 ? 'col-span-2 aspect-[2/1]' : 'aspect-square',
              )}
              aria-label={more ? `Ver mais ${hidden + 1} imagens` : `Ver ${file.name}`}
            >
              <img
                src={fileUrl(file.fileId, true)}
                alt=""
                loading="lazy"
                className="size-full object-cover transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover/tile:scale-[1.04]"
              />
              {more ? (
                <span className="display absolute inset-0 flex items-center justify-center bg-black/50 text-3xl text-white">
                  +{hidden + 1}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2.5 py-2 pr-2 pl-3.5">
        <p className="tag text-muted-foreground flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-xs">
          <span>{files.length} imagens</span>
          <span aria-hidden="true">·</span>
          <span>{formatBytes(total)}</span>
          {expiry ? (
            <>
              <span aria-hidden="true">·</span>
              <span className={cn(expiringSoon && 'text-warning')}>{expiry}</span>
            </>
          ) : null}
        </p>
        <button
          type="button"
          onClick={downloadAll}
          className="bg-foreground text-background hover:bg-foreground/85 flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors"
          aria-label={`Descarregar as ${files.length} imagens`}
          title="Descarregar todas"
        >
          <Icon name="download" className="size-4" />
        </button>
      </div>
    </Capsule>
  )
}
