import { promises as fsp } from 'node:fs'
import { loadConfig } from './config.ts'
import { buildApp } from './app.ts'
import { generatePin } from './lib/auth.ts'
import { IndexCorruptError } from './lib/store.ts'
import { reconcileData, sweepExpired } from './lib/sweeper.ts'
import { lanUrls, preferPrimary, qrOf, type LanUrl } from './lib/net.ts'
import { freeBytes, formatBytes } from './lib/disk.ts'

const config = loadConfig()
const pin = config.pin ?? generatePin()

// Pastas antes do registo do @fastify/static (raiz tem de existir).
await fsp.mkdir(config.tmpDir, { recursive: true })
await fsp.mkdir(config.uploadDir, { recursive: true })

const { app, sessions, store, hub } = await buildApp({ config, pin })

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

async function printAddresses(): Promise<void> {
  knownUrls = lanUrls(config.port)
  primary = preferPrimary(knownUrls)
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
  const free = await freeBytes(config.uploadDir)
  app.log.info({ free: formatBytes(free) }, 'Espaço livre')
  app.log.warn('LAN-only: nunca exponhas esta porta na Internet (sem port forwarding).')
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
    app.log.info('As interfaces de rede mudaram:')
    for (const u of now) app.log.info({ iface: u.iface }, u.url)
    const p = preferPrimary(now)
    if (p && p.url !== primary?.url) {
      primary = p
      const qc = qrOf(p.url)
      if (qc) console.log(`\n${qc}\n`)
    }
  } catch (err) {
    app.log.error({ err }, 'Erro na re-varredura de interfaces')
  }
}, 60_000)
rescanTimer.unref()

let shuttingDown = false
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  const timers = [pruneTimer, sweepTimer, rescanTimer]
  for (const timer of timers) clearInterval(timer)
  app.log.info({ signal }, 'A encerrar graciosamente…')
  hub.closeAll(1001, 'Servidor a fechar')
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
  await app.listen({ port: config.port, host: config.host })
  await printAddresses()
} catch (err) {
  app.log.error(err)
  process.exit(1)
}