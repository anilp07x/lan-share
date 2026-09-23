import path from 'node:path'

export interface Config {
  port: number
  host: string
  pin: string | null
  maxFileBytes: number
  retentionMs: number
  uploadDir: string
  tmpDir: string
  indexFile: string
  minFreeDiskBytes: number
  maxTextLen: number
  historyLimit: number
  sessionTtlMs: number
  previewMaxBytes: number
  sweepIntervalMs: number
}

type IntOptions = { min?: number; max?: number }

function intEnv(
  env: Record<string, string | undefined>,
  name: string,
  def: number,
  opts: IntOptions = {},
): number {
  const raw = env[name]
  if (raw === undefined || raw.trim() === '') return def
  const n = Number(raw)
  if (!Number.isInteger(n)) throw new Error(`${name} deve ser um número inteiro`)
  const { min, max } = opts
  if (min !== undefined && n < min) throw new Error(`${name} deve ser >= ${min}`)
  if (max !== undefined && n > max) throw new Error(`${name} deve ser <= ${max}`)
  return n
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const port = intEnv(env, 'PORT', 3000, { min: 1, max: 65535 })
  const host = env.HOST?.trim() || '0.0.0.0'

  let pin: string | null = null
  const rawPin = env.PIN
  if (rawPin !== undefined && rawPin.trim() !== '') {
    if (!/^\d{6}$/.test(rawPin.trim())) {
      throw new Error('PIN deve ser exatamente 6 dígitos (ex.: 123456)')
    }
    pin = rawPin.trim()
  }

  const maxFileMb = intEnv(env, 'MAX_FILE_MB', 2048, { min: 1 })
  const minFreeDiskMb = intEnv(env, 'MIN_FREE_DISK_MB', 512, { min: 0 })
  const maxTextLen = intEnv(env, 'MAX_TEXT_LEN', 2000, { min: 1, max: 100000 })
  const historyLimit = intEnv(env, 'HISTORY_LIMIT', 50, { min: 1, max: 5000 })
  const sweepIntervalMin = intEnv(env, 'SWEEP_INTERVAL_MIN', 5, { min: 1 })

  const retentionHours = (() => {
    const raw = env.RETENTION_HOURS
    if (raw === undefined || raw.trim() === '') return 24
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) throw new Error('RETENTION_HOURS deve ser um número >= 0')
    return n
  })()

  const uploadDir = path.resolve(env.UPLOAD_DIR?.trim() || './data/files')
  const indexFile = path.join(path.dirname(uploadDir), 'index.json')
  const tmpDir = path.join(uploadDir, 'tmp')

  return {
    port,
    host,
    pin,
    maxFileBytes: maxFileMb * 1024 * 1024,
    retentionMs: retentionHours === 0 ? 0 : retentionHours * 3600 * 1000,
    uploadDir,
    tmpDir,
    indexFile,
    minFreeDiskBytes: minFreeDiskMb * 1024 * 1024,
    maxTextLen,
    historyLimit,
    sessionTtlMs: 12 * 3600 * 1000,
    previewMaxBytes: 20 * 1024 * 1024,
    sweepIntervalMs: sweepIntervalMin * 60_000,
  }
}