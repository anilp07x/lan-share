import type { FileMeta } from '../types.ts'

export const PREVIEW_MAX_BYTES = 20 * 1024 * 1024

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = n
  let i = -1
  do {
    value /= 1024
    i++
  } while (value >= 1024 && i < units.length - 1)
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function dayKey(ts: number): string {
  return String(startOfDay(new Date(ts)))
}

export function formatDay(ts: number): string {
  const date = new Date(ts)
  const today = new Date()
  if (startOfDay(date) === startOfDay(today)) return 'Hoje'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (startOfDay(date) === startOfDay(yesterday)) return 'Ontem'
  return date.toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

export function isPreviewable(file: FileMeta): boolean {
  return file.mime.startsWith('image/') && file.size <= PREVIEW_MAX_BYTES
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* cai no fallback */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}