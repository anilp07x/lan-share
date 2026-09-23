import os from 'node:os'
import qrcodeTerminal from 'qrcode-terminal'

export interface LanUrl {
  iface: string
  url: string
}

function rank(addr: string): number {
  if (addr.startsWith('192.168.')) return 0
  if (addr.startsWith('10.')) return 1
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(addr)) return 2
  return 3
}

/** URLs por interface (IPv4, não-internos), sem duplicados. */
export function lanUrls(port: number): LanUrl[] {
  const out: LanUrl[] = []
  const seen = new Set<string>()
  for (const [iface, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue
      const url = `http://${a.address}:${port}`
      if (seen.has(url)) continue
      seen.add(url)
      out.push({ iface, url })
    }
  }
  return out
}

/** URL preferida para o QR: 192.168.* → 10.* → 172.16-31.* → qualquer. */
export function preferPrimary(urls: LanUrl[]): LanUrl | null {
  if (urls.length === 0) return null
  return [...urls].sort((a, b) => {
    const rankA = rank(a.url.replace(/^http:\/\//, '').split(':')[0] ?? '')
    const rankB = rank(b.url.replace(/^http:\/\//, '').split(':')[0] ?? '')
    return rankA - rankB
  })[0] ?? null
}

/** Texto ANSI do QR (devolve null se a lib falhar). */
export function qrOf(text: string): string | null {
  try {
    let out = ''
    qrcodeTerminal.generate(text, { small: true }, (s: string) => {
      out = s
    })
    return out.length > 0 ? out : null
  } catch {
    return null
  }
}