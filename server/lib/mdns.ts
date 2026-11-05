import os from 'node:os'
import makeMdns from 'multicast-dns'

/** Responde a "lanshare.local?" na rede local com os IPv4 deste computador. */
export interface MdnsResponder {
  close: () => void
}

/** IPv4 da interface na mesma sub-rede de quem pergunta (senão, todos). */
function addressesFor(remote: string | undefined): string[] {
  const all: { address: string; netmask: string }[] = []
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) if (a.family === 'IPv4' && !a.internal) all.push(a)
  }
  if (remote) {
    const toInt = (ip: string) => ip.split('.').reduce((n, part) => (n << 8) + Number(part), 0) >>> 0
    const same = all.filter((a) => ((toInt(a.address) ^ toInt(remote)) & toInt(a.netmask)) === 0)
    if (same.length > 0) return same.map((a) => a.address)
  }
  return all.map((a) => a.address)
}

export function startMdns(hostname: string, log: (msg: string) => void): MdnsResponder | null {
  const name = hostname.toLowerCase()
  let mdns: ReturnType<typeof makeMdns>
  try {
    mdns = makeMdns()
  } catch (err) {
    log(`mDNS indisponível (${(err as Error).message}); usa o endereço IP.`)
    return null
  }
  mdns.on('error', (err: Error) => log(`mDNS: ${err.message}`))
  mdns.on('query', (query, rinfo) => {
    const asked = query.questions.some((q) => q.name.toLowerCase() === name && (q.type === 'A' || (q.type as string) === 'ANY'))
    if (!asked) return
    const answers = addressesFor(rinfo?.address).map((ip) => ({
      name: hostname,
      type: 'A' as const,
      ttl: 120,
      flush: true,
      data: ip,
    }))
    if (answers.length > 0) mdns.respond({ answers })
  })
  return { close: () => mdns.destroy() }
}
