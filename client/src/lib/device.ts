import { useSyncExternalStore } from 'react'
import type { Sender } from '../types.ts'

/** Identidade local do dispositivo: id aleatório + nome escolhido. Não é autenticação. */
export interface Device extends Sender {
  /** false enquanto o nome é só o palpite automático */
  named: boolean
}

const KEY = 'lanshare.device'
export const DEVICE_NAME_MAX = 40

function randomId(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Palpite legível a partir do user agent ("iPhone", "Android", "PC Windows"…). */
export function guessDeviceName(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad'
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Telemóvel Android' : 'Tablet Android'
  if (/Windows/.test(ua)) return 'PC Windows'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/CrOS/.test(ua)) return 'Chromebook'
  if (/Linux/.test(ua)) return 'PC Linux'
  return 'Dispositivo'
}

function read(): Device {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Device>
      if (typeof parsed.id === 'string' && typeof parsed.name === 'string' && parsed.name.trim()) {
        return { id: parsed.id, name: parsed.name, named: parsed.named === true }
      }
    }
  } catch {
    /* armazenamento indisponível: identidade só desta sessão */
  }
  return { id: randomId(), name: guessDeviceName(), named: false }
}

let current: Device = read()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* ignora */
  }
}
persist()

export function getDevice(): Device {
  return current
}

export function setDeviceName(name: string): void {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, DEVICE_NAME_MAX)
  current = { ...current, name: clean || current.name, named: true }
  persist()
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useDevice(): Device {
  return useSyncExternalStore(subscribe, getDevice)
}

/** Cor estável por remetente, de uma paleta curta de esmaltes (nunca o âmbar do "meu"). */
const ENAMELS = ['#2f7d6d', '#3d6fb0', '#8a5aa8', '#b0503d', '#5d8a2f', '#a07a1f', '#2f8aa0', '#a04f78']

export function senderHue(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return ENAMELS[h % ENAMELS.length] ?? ENAMELS[0]!
}
