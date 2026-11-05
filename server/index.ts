import { promises as fsp } from 'node:fs'
import path from 'node:path'
import type https from 'node:https'
import { loadConfig } from './config.ts'
import { buildApp } from './app.ts'
import { generatePin } from './lib/auth.ts'
import { IndexCorruptError } from './lib/store.ts'
import { reconcileData, sweepExpired } from './lib/sweeper.ts'
import { lanUrls, preferPrimary, qrOf, type LanUrl } from './lib/net.ts'
import { freeBytes, formatBytes } from './lib/disk.ts'
import { ensureTls, localIps, type TlsMaterial } from './lib/tls.ts'
import { startMdns } from './lib/mdns.ts'

const config = loadConfig()
const pin = config.pin ?? generatePin()

// Pastas antes do registo do @fastify/static (raiz tem de existir).
await fsp.mkdir(config.tmpDir, { recursive: true })
await fsp.mkdir(config.uploadDir, { recursive: true })

// HTTPS com certificado próprio (avisos do sistema nos telemóveis precisam dele).
let tls: TlsMaterial | undefined
if (config.httpsPort) {
  try {
    tls = await ensureTls(config.tlsDir, config.mdnsHost)
  } catch (err) {
    console.error(`Não foi possível preparar o HTTPS (${(err as Error).message}); a continuar só com HTTP.`)
  }
}
const httpsPort = tls ? config.httpsPort : null

const { app, sessions, store, hub, plainServer } = await buildApp({ config, pin, tls })
const mdns = startMdns(config.mdnsHost, (msg) => app.log.warn(msg))

// Recuperação do índice + limpeza no arranque.
try {
  await store.load()
} catch (err) {
  if (err instanceof IndexCorruptError) {
    const backup = `${config.indexFile}.corrupt-${Date.now()}`
    await fsp.rename(config.indexFile, backup).catch(() => {})
    app.log.warn({ backup }, 'Índice corrompido movido para backup; a começar vazio')
  } else {
    throw err
  }
}

const sweep = await reconcileData(config, store, (msg) => app.log.info({ msg }, 'limpeza'))
app.log.info(sweep, 'Limpeza no arranque terminada')

app.log.info('── LAN Share ──')
app.log.info({ pin }, 'PIN de acesso (mostra aos telemóveis)')
app.log.info(
  {
    maxFileMb: Math.round(config.maxFileBytes / 1024 / 1024),
    retentionHours: config.retentionMs === 0 ? 'ilimitado' : config.retentionMs / 3_600_000,
    minFreeDiskMb: Math.round(config.minFreeDiskBytes / 1024 / 1024),
    uploadDir: config.uploadDir,
  },
  'Configuração',
)

const pruneTimer = setInterval(() => sessions.prune(), 10 * 60 * 1000)
pruneTimer.unref()

const sweepTimer = setInterval(async () => {
  try {
    const expiredFileIds = await sweepExpired(config, store, (msg) => app.log.info({ msg }, 'sweep'))
    if (expiredFileIds.length > 0) {
      app.log.info({ count: expiredFileIds.length }, 'ficheiros expirados removidos')
      for (const fileId of expiredFileIds) {
        hub.broadcastFileExpired(fileId)
      }
    }
  } catch (err) {
    app.log.error({ err }, 'Erro no sweep periódico')
  }
}, config.sweepIntervalMs)
sweepTimer.unref()

let knownUrls: LanUrl[] = []
let primary: LanUrl | null = null

function emitIpc(): void {
  if (process.env.LANSHARE_IPC !== '1') return
  const payload = {
    url: primary?.url ?? null,
    pin,
    port: config.port,
    uploadDir: config.uploadDir,
    interfaces: knownUrls.map((u) => ({ iface: u.iface, url: u.url })),
    secureUrl: httpsPort ? (preferPrimary(lanUrls(httpsPort, 'https'))?.url ?? null) : null,
    mdnsUrl: httpsPort ? `https://${config.mdnsHost}:${httpsPort}` : null,
    caFile: tls ? path.join(config.tlsDir, 'ca.crt') : null,
  }
  console.log(`LANSHARE_IPC ${JSON.stringify(payload)}`)
}

async function printAddresses(): Promise<void> {
  knownUrls = lanUrls(config.port)
  primary = preferPrimary(knownUrls)
  emitIpc()
  if (knownUrls.length === 0) {
    app.log.warn('Sem interfaces de rede IPv4 visíveis. Liga-te em http://localhost:<porta>.')
    return
  }
  app.log.info(`── Abre a LAN Share noutro telemóvel em: ──`)
  for (const u of knownUrls) {
    app.log.info({ iface: u.iface }, u.url)
  }
  if (primary) {
    app.log.info({ primary: primary.url }, 'URL para o QR')
    const qc = qrOf(primary.url)
    if (qc) {
      // QR é gráfico; sai direto para o terminal (não passa pelo pino JSON).
      console.log(`\n${qc}\n`)
    } else {
      app.log.warn('Não foi possível gerar o QR neste terminal. Usa o URL acima. Dica: Windows Terminal mostra melhor o QR.')
    }
  }
  if (httpsPort && primary) {
    app.log.info(`── HTTPS (avisos nos telemóveis): https://${config.mdnsHost}:${httpsPort} ──`)
    app.log.info(`Instala o certificado em cada dispositivo uma vez: ${primary.url}/ca.crt`)
  }
  const free = await freeBytes(config.uploadDir)
  app.log.info({ free: formatBytes(free) }, 'Espaço livre')
  app.log.warn('LAN-only: nunca exponhas esta porta na Internet (sem port forwarding).')
}

/** IP novo (ou validade a acabar): o servidor reemite o próprio certificado. */
async function renewTls(): Promise<void> {
  if (!tls) return
  const ips = localIps()
  const next = await ensureTls(config.tlsDir, config.mdnsHost, ips)
  if (next.cert === tls.cert) return
  tls = next
  ;(app.server as unknown as https.Server).setSecureContext({ key: next.key, cert: next.cert })
  app.log.info({ ips }, 'Certificado HTTPS renovado')
}

// Re-varredura: imprime mudanças; novo QR só se o URL preferido mudar.
const rescanTimer = setInterval(async () => {
  try {
    const now = lanUrls(config.port)
    const same = (candidate: LanUrl[]): boolean =>
      candidate.length === knownUrls.length &&
      candidate.every((u, i) => u.url === knownUrls[i]?.url)
    if (same(now)) return
    knownUrls = now
    await renewTls()
    app.log.info('As interfaces de rede mudaram:')
    for (const u of now) app.log.info({ iface: u.iface }, u.url)
    const p = preferPrimary(now)
    if (p && p.url !== primary?.url) {
      primary = p
      emitIpc()
      const qc = qrOf(p.url)
      if (qc) console.log(`\n${qc}\n`)
    }
  } catch (err) {
    app.log.error({ err }, 'Erro na re-varredura de interfaces')
  }
}, 60_000)
rescanTimer.unref()

// a validade também acaba sem mudar de rede: confirma duas vezes por dia
const tlsTimer = setInterval(() => {
  renewTls().catch((err: unknown) => app.log.error({ err }, 'Erro ao renovar o certificado'))
}, 12 * 3_600_000)
tlsTimer.unref()

let shuttingDown = false
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  const timers = [pruneTimer, sweepTimer, rescanTimer, tlsTimer]
  for (const timer of timers) clearInterval(timer)
  app.log.info({ signal }, 'A encerrar graciosamente…')
  hub.closeAll(1001, 'Servidor a fechar')
  mdns?.close()
  try {
    await store.save()
  } catch (err) {
    app.log.error({ err }, 'Falha ao gravar o índice no fecho')
  }
  try {
    await app.close()
  } catch (err) {
    app.log.error({ err }, 'Erro ao fechar o servidor')
  }
  process.exit(0)
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))

try {
  if (plainServer && httpsPort) {
    await app.listen({ port: httpsPort, host: config.host })
    const plain = plainServer
    await new Promise<void>((resolve, reject) => {
      plain.once('error', reject)
      plain.listen(config.port, config.host, () => resolve())
    })
  } else {
    await app.listen({ port: config.port, host: config.host })
  }
  await printAddresses()
} catch (err) {
  app.log.error(err)
  process.exit(1)
}