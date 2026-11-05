import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { Message } from '../types.ts'

const KEY = 'lanshare.alerts'
const BASE_TITLE = document.title

// ── preferência (som + aviso do sistema), por dispositivo ─────────────

let enabled = (() => {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
})()
const listeners = new Set<() => void>()

/** O browser só mostra avisos do sistema em contexto seguro (https ou localhost). */
export const systemAlertsSupported = typeof Notification !== 'undefined' && window.isSecureContext

export function useAlertsEnabled(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => enabled,
  )
}

export async function setAlertsEnabled(on: boolean): Promise<void> {
  enabled = on
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* fica só nesta sessão */
  }
  listeners.forEach((cb) => cb())
  if (on) {
    unlockAudio()
    if (systemAlertsSupported && Notification.permission === 'default') await Notification.requestPermission()
  }
}

// ── som: dois toques curtos gerados na hora (sem ficheiros de áudio) ──

let audio: AudioContext | null = null

/** Os browsers só deixam tocar som depois de um gesto do utilizador. */
function unlockAudio(): void {
  try {
    audio ??= new AudioContext()
    void audio.resume()
  } catch {
    audio = null
  }
}

function chime(): void {
  if (!audio) return
  const t = audio.currentTime
  for (const [i, freq] of [880, 1320].entries()) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t + i * 0.12)
    gain.gain.exponentialRampToValueAtTime(0.18, t + i * 0.12 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.25)
    osc.connect(gain).connect(audio.destination)
    osc.start(t + i * 0.12)
    osc.stop(t + i * 0.12 + 0.3)
  }
}

function describe(m: Message): string {
  return m.kind === 'text' ? m.body.slice(0, 140) : `Ficheiro: ${m.file.name}`
}

/**
 * Avisa quando chega algo de outro dispositivo com a app em segundo plano:
 * contagem no título do separador sempre; som e aviso do sistema se ativos.
 */
export function useArrivalAlerts(messages: Message[], selfId: string): void {
  const knownRef = useRef<Set<string> | null>(null)
  const unreadRef = useRef(0)

  useEffect(() => {
    if (enabled) {
      // um clique qualquer na página destrava o som guardado de uma visita anterior
      const unlock = () => unlockAudio()
      window.addEventListener('pointerdown', unlock, { once: true })
      return () => window.removeEventListener('pointerdown', unlock)
    }
  }, [])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      unreadRef.current = 0
      document.title = BASE_TITLE
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    // o primeiro lote (histórico) não avisa
    if (knownRef.current === null) {
      if (messages.length > 0) knownRef.current = new Set(messages.map((m) => m.id))
      return
    }
    const known = knownRef.current
    const arrived = messages.filter((m) => !known.has(m.id))
    arrived.forEach((m) => known.add(m.id))
    const fromOthers = arrived.filter((m) => m.from?.id !== selfId)
    if (fromOthers.length === 0 || document.visibilityState === 'visible') return

    unreadRef.current += fromOthers.length
    document.title = `(${unreadRef.current}) ${BASE_TITLE}`
    if (!enabled) return
    chime()
    if (systemAlertsSupported && Notification.permission === 'granted') {
      const last = fromOthers[fromOthers.length - 1]!
      const n = new Notification(last.from?.name ?? 'LAN Share', {
        body: fromOthers.length > 1 ? `${fromOthers.length} envios novos` : describe(last),
        tag: 'lanshare',
      })
      n.onclick = () => {
        window.focus()
        n.close()
      }
    }
  }, [messages, selfId])
}
