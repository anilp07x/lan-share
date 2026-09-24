import { useSyncExternalStore } from 'react'
import { cn } from './utils.ts'
import Icon from '@/components/Icon.tsx'
import { prefersReducedMotion } from './motion.ts'

export interface ToastItem {
  id: number
  text: string
  tone: 'error' | 'info'
}

let toasts: ToastItem[] = []
let seq = 0
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

function show(text: string, tone: ToastItem['tone']) {
  const id = ++seq
  toasts = [...toasts, { id, text, tone }]
  notify()
  window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    notify()
  }, 4500)
}

export const toast = {
  error(text: string) {
    show(text, 'error')
  },
  info(text: string) {
    show(text, 'info')
  },
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts)
  const reduced = prefersReducedMotion()
  return (
    <div
      role="region"
      aria-label="Avisos"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'bg-card text-foreground pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl border border-border px-3.5 py-2.5 text-sm',
            !reduced && 'animate-toast-in',
          )}
        >
          <Icon
            name={t.tone === 'error' ? 'x' : 'check'}
            className={cn('size-4 shrink-0', t.tone === 'error' ? 'text-destructive' : 'text-success')}
          />
          <span className="min-w-0 flex-1">{t.text}</span>
        </div>
      ))}
    </div>
  )
}