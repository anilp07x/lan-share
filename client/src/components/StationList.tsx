import type { Sender } from '../types.ts'
import { senderHue } from '../lib/device.ts'
import { cn } from '../lib/utils.ts'

interface StationListProps {
  peers: Sender[]
  selfId: string
  tone?: 'surface' | 'shell'
}

/** Dispositivos com a LAN Share aberta agora; o próprio primeiro. */
export default function StationList({ peers, selfId, tone = 'surface' }: StationListProps) {
  const sorted = [...peers].sort((a, b) => Number(b.id === selfId) - Number(a.id === selfId) || a.name.localeCompare(b.name))
  const muted = tone === 'shell' ? 'text-shell-muted' : 'text-muted-foreground'

  if (sorted.length === 0) {
    return <p className={cn('text-sm', muted)}>Ainda ninguém ligado.</p>
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {sorted.map((peer) => {
        const self = peer.id === selfId
        return (
          <li key={peer.id} className="flex min-h-8 items-center gap-2.5 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: self ? 'var(--primary)' : senderHue(peer.id) }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate">{peer.name}</span>
            {self ? <span className={cn('tag text-[11px]', muted)}>Este</span> : null}
          </li>
        )
      })}
    </ul>
  )
}
