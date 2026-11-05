import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Icon from './Icon.tsx'
import type { FileMessage, Message, Sender, ServerInfo } from '../types.ts'
import type { WsStatus } from '../ws.ts'
import { dayKey, formatDay, isImage, isPreviewable } from '../lib/format.ts'
import { prefersReducedMotion } from '../lib/motion.ts'
import { useDevice } from '../lib/device.ts'
import { useNow } from '../hooks/useNow.ts'
import { cn } from '../lib/utils.ts'
import { Button } from './ui/button.tsx'
import StatusBar from './StatusBar.tsx'
import FilterBar, { FILTERS, type Filter } from './FilterBar.tsx'
import MessageItem, { AlbumItem, type CapsuleActions } from './MessageItem.tsx'
import DeleteDialog from './DeleteDialog.tsx'
import Gallery from './Gallery.tsx'
import Composer from './Composer.tsx'
import ConnectDialog from './ConnectDialog.tsx'
import ImagePreview, { type PreviewState } from './ImagePreview.tsx'
import SecureDialog from './SecureDialog.tsx'

interface FeedProps {
  messages: Message[]
  peers: Sender[]
  info: ServerInfo | null
  wsStatus: WsStatus
  addMessage: (message: Message) => void
  onAuthFail: () => void
  onLogout: () => void
  onRename: () => void
}

function matchesFilter(m: Message, filter: Filter): boolean {
  if (filter === 'all') return true
  if (filter === 'text') return m.kind === 'text'
  if (filter === 'images') return m.kind === 'file' && isImage(m.file)
  return m.kind === 'file' && !isImage(m.file)
}

function matchesQuery(m: Message, q: string): boolean {
  if (!q) return true
  const hay = [m.kind === 'text' ? m.body : m.file.name, m.from?.name ?? ''].join('\n').toLocaleLowerCase('pt')
  return hay.includes(q)
}

/** Imagens seguidas do mesmo remetente, com menos de 2 min entre elas, formam um álbum. */
const ALBUM_GAP_MS = 2 * 60_000

type Row = { kind: 'single'; message: Message } | { kind: 'album'; messages: [FileMessage, ...FileMessage[]] }

function isAlbumImage(m: Message): m is FileMessage {
  return m.kind === 'file' && isPreviewable(m.file) && m.from !== undefined
}

/** Um álbum não mistura envios para todos com envios privados (nem destinatários diferentes). */
function audienceKey(m: Message): string {
  return m.to ? m.to.map((r) => r.id).sort().join(',') : '*'
}

function groupRows(messages: Message[]): Row[] {
  const rows: Row[] = []
  for (const m of messages) {
    const prev = rows.at(-1)
    const tail = prev?.kind === 'album' ? prev.messages.at(-1) : prev?.message
    if (
      prev &&
      tail &&
      isAlbumImage(m) &&
      isAlbumImage(tail) &&
      tail.from?.id === m.from?.id &&
      audienceKey(tail) === audienceKey(m) &&
      m.ts - tail.ts <= ALBUM_GAP_MS &&
      dayKey(m.ts) === dayKey(tail.ts)
    ) {
      if (prev.kind === 'album') prev.messages.push(m)
      else rows[rows.length - 1] = { kind: 'album', messages: [tail, m] }
    } else {
      rows.push({ kind: 'single', message: m })
    }
  }
  return rows
}

function EmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="text-muted-foreground mb-1 flex items-center gap-2" aria-hidden="true">
        <span className="bg-border h-px w-10" />
        <Icon name="capsule" className="size-7" />
        <span className="bg-border h-px w-10" />
      </div>
      <h2 className="display text-[28px]">O tubo está vazio</h2>
      <p className="text-muted-foreground max-w-sm text-[15px] text-pretty">
        Escreve em baixo ou larga um ficheiro para o enviar a todos os dispositivos ligados nesta rede.
      </p>
      <Button variant="outline" className="mt-2" onClick={onConnect}>
        <Icon name="qr" className="size-4" />
        Ligar outro dispositivo
      </Button>
    </div>
  )
}

function NoResults({ label, onReset }: { label: string; onReset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <p className="text-muted-foreground text-[15px]">{label}</p>
      <Button variant="outline" size="sm" onClick={onReset}>
        Ver tudo
      </Button>
    </div>
  )
}

export default function Feed({ messages, peers, info, wsStatus, addMessage, onAuthFail, onLogout, onRename }: FeedProps) {
  const device = useDevice()
  const now = useNow()
  const listRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const [unseen, setUnseen] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [connectOpen, setConnectOpen] = useState(false)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [deleting, setDeleting] = useState<Message[] | null>(null)
  const [secureOpen, setSecureOpen] = useState(false)
  // guia do HTTPS (com QR para os telemóveis): só numa página HTTP de um servidor que tem HTTPS
  const openSecure =
    info?.secure && window.location.protocol === 'http:'
      ? () => {
          setConnectOpen(false)
          setSecureOpen(true)
        }
      : undefined
  // ids presentes no primeiro render com conteúdo: o histórico entra sem animação
  const seenRef = useRef<Set<string> | null>(null)
  const prevCountRef = useRef(messages.length)

  if (seenRef.current === null && messages.length > 0) {
    seenRef.current = new Set(messages.map((m) => m.id))
  }

  const q = query.trim().toLocaleLowerCase('pt')
  const counts = useMemo(() => {
    const out = { all: 0, text: 0, files: 0, images: 0 } satisfies Record<Filter, number>
    for (const m of messages) {
      if (!matchesQuery(m, q)) continue
      out.all++
      if (m.kind === 'text') out.text++
      else if (isImage(m.file)) out.images++
      else out.files++
    }
    return out
  }, [messages, q])
  const visible = useMemo(() => messages.filter((m) => matchesFilter(m, filter) && matchesQuery(m, q)), [messages, filter, q])
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])
  const others = useMemo(() => peers.filter((p) => p.id !== device.id), [peers, device.id])

  // a mensagem a que estava a responder foi apagada ou expirou
  useEffect(() => {
    if (replyTo && !byId.has(replyTo.id)) setReplyTo(null)
  }, [replyTo, byId])

  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' })
    atBottomRef.current = true
    setUnseen(0)
  }, [])

  // ── scroll automático só se o utilizador estiver no fundo ────────────
  useLayoutEffect(() => {
    const added = messages.length - prevCountRef.current
    prevCountRef.current = messages.length
    if (atBottomRef.current) scrollToBottom()
    else if (added > 0) setUnseen((n) => n + added)
  }, [messages, scrollToBottom])

  // imagens a carregar ou o compositor a crescer mudam alturas: quem está no fim continua no fim
  useEffect(() => {
    const el = contentRef.current
    const list = listRef.current
    if (!el || !list || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (atBottomRef.current) list.scrollTop = list.scrollHeight
    })
    ro.observe(el)
    ro.observe(list) // o compositor cresce com a fila de anexos e encolhe a lista
    return () => ro.disconnect()
  }, [])

  // mudar de filtro ou pesquisa recomeça no envio mais recente
  useLayoutEffect(() => {
    scrollToBottom()
  }, [filter, q, scrollToBottom])

  // o que eu envio leva-me sempre ao fim (e volta a mostrar tudo)
  const onOwnMessage = useCallback(
    (message: Message) => {
      atBottomRef.current = true
      setFilter('all')
      setQuery('')
      addMessage(message)
      requestAnimationFrame(() => scrollToBottom())
    },
    [addMessage, scrollToBottom],
  )

  useEffect(() => {
    if (messages.length === 0) setUnseen(0)
  }, [messages.length])

  // citação: leva à mensagem original (mostrando tudo, se um filtro a escondia) e faz piscar a guia
  const jumpTo = useCallback((id: string) => {
    setFilter('all')
    setQuery('')
    requestAnimationFrame(() => {
      const el = document.getElementById(`msg-${id}`)
      if (!el) return
      el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      el.classList.remove('jump-flash')
      void el.offsetWidth
      el.classList.add('jump-flash')
    })
  }, [])

  const actions: CapsuleActions = { onReply: setReplyTo, onDelete: setDeleting, onJump: jumpTo }

  const retention = info?.retentionMs
  const resetFilters = () => {
    setFilter('all')
    setQuery('')
  }

  let content: ReactNode
  if (messages.length === 0) {
    content = <EmptyState onConnect={() => setConnectOpen(true)} />
  } else if (visible.length === 0) {
    const tab = FILTERS.find((f) => f.id === filter)?.label ?? ''
    content = (
      <NoResults
        label={q ? `Nada encontrado para «${query.trim()}».` : `Ainda não há nada em ${tab}.`}
        onReset={resetFilters}
      />
    )
  } else if (filter === 'images') {
    content = (
      <Gallery
        items={visible.filter((m): m is FileMessage => m.kind === 'file')}
        selfId={device.id}
        onPreview={(items, index) => setPreview({ items, index })}
      />
    )
  } else {
    const rows: ReactNode[] = []
    let prevDay: string | null = null
    for (const row of groupRows(visible)) {
      const message = row.kind === 'album' ? row.messages[0] : row.message
      const dk = dayKey(message.ts)
      if (prevDay !== dk) {
        prevDay = dk
        rows.push(
          <div className="flex items-center gap-3 pt-4 pb-1" key={`day-${dk}`} role="separator">
            <span className="bg-border h-px flex-1" aria-hidden="true" />
            <span className="tag text-muted-foreground text-xs">{formatDay(message.ts)}</span>
            <span className="bg-border h-px flex-1" aria-hidden="true" />
          </div>,
        )
      }
      const mine = message.from?.id === device.id
      const fresh = !seenRef.current?.has(message.id)
      rows.push(
        <div
          key={message.id}
          className={cn('flex flex-col', fresh && (mine ? 'animate-capsule-out origin-bottom' : 'animate-capsule-in'))}
        >
          {row.kind === 'album' ? (
            <AlbumItem
              {...actions}
              messages={row.messages}
              mine={mine}
              selfId={device.id}
              now={now}
              expiresAt={retention ? message.ts + retention : undefined}
              onPreview={(items, index) => setPreview({ items, index })}
            />
          ) : (
            <MessageItem
              {...actions}
              message={message}
              mine={mine}
              selfId={device.id}
              quoted={message.kind === 'text' && message.replyTo ? (byId.get(message.replyTo) ?? null) : undefined}
              query={q}
              now={now}
              expiresAt={message.kind === 'file' && retention ? message.ts + retention : undefined}
              onPreview={(file) => setPreview({ items: [file], index: 0 })}
            />
          )}
        </div>,
      )
    }
    content = <div className="flex flex-col gap-2.5 pt-2 pb-4">{rows}</div>
  }

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <StatusBar
        wsStatus={wsStatus}
        peers={peers}
        onLogout={onLogout}
        onRename={onRename}
        onConnect={() => setConnectOpen(true)}
        onSecureSetup={openSecure}
      />

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          ref={listRef}
          role="log"
          aria-label="Envios"
          className="feed-scroll flex min-h-0 flex-1 flex-col"
          onScroll={() => {
            const el = listRef.current
            if (!el) return
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
            atBottomRef.current = atBottom
            if (atBottom) setUnseen(0)
          }}
        >
          {messages.length > 0 ? (
            <FilterBar filter={filter} onFilter={setFilter} counts={counts} query={query} onQuery={setQuery} />
          ) : null}
          <div ref={contentRef} className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-3 sm:px-6">
            {content}
          </div>
        </div>

        {unseen > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] flex justify-center">
            <Button
              size="sm"
              className="animate-fade-in pointer-events-auto rounded-full shadow-[0_6px_20px_-6px_rgb(0_0_0/0.35)]"
              onClick={() => scrollToBottom(true)}
            >
              <Icon name="arrow-down" className="size-3.5" />
              {unseen === 1 ? '1 envio novo' : `${unseen} envios novos`}
            </Button>
          </div>
        ) : null}

        <div className="mx-auto w-full max-w-3xl px-3 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <Composer
            connected={wsStatus === 'open'}
            maxFileMb={info?.maxFileMb}
            peers={others}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            onMessage={onOwnMessage}
            onAuthFail={onAuthFail}
          />
        </div>
      </main>

      <ConnectDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        info={info}
        peers={peers}
        onRename={() => {
          setConnectOpen(false)
          onRename()
        }}
        onSecureSetup={openSecure}
      />
      {info?.secure ? <SecureDialog open={secureOpen} onOpenChange={setSecureOpen} secure={info.secure} /> : null}
      <ImagePreview preview={preview} onChange={setPreview} />
      <DeleteDialog messages={deleting} onDone={() => setDeleting(null)} onAuthFail={onAuthFail} />
    </div>
  )
}
