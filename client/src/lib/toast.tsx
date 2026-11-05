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
      className="pointer-events-none fixed inset-x-0 bottom-[calc(7rem+env(safe-area-inset-bottom))] md:left-72 z-50 flex flex-col items-center gap-2 px-4"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'bg-shell text-shell-foreground pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl px-4 py-3 text-sm shadow-[0_12px_32px_-12px_rgb(0_0_0/0.5)]',
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