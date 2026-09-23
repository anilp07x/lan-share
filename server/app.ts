import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import Fastify, { type FastifyInstance } from 'fastify'
import fastifyStatic from '@fastify/static'
import fastifyCookie from '@fastify/cookie'
import fastifyHelmet from '@fastify/helmet'
import fastifyMultipart from '@fastify/multipart'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifyWebsocket from '@fastify/websocket'
import type { Config } from './config.ts'
import { makeError, type ErrorCode } from './types.ts'
import type { SessionStore } from './lib/sessions.ts'
import { SessionStore as SessionStoreImpl } from './lib/sessions.ts'
import { Store } from './lib/store.ts'
import { WsHub } from './ws/hub.ts'
import { authRoutes, SESSION_COOKIE } from './routes/auth.ts'
import { messageRoutes } from './routes/messages.ts'
import { historyRoutes } from './routes/history.ts'
import { uploadRoutes } from './routes/upload.ts'
import { filesRoutes } from './routes/files.ts'
import { wsRoutes } from './routes/ws.ts'

const serverDir = path.dirname(fileURLToPath(import.meta.url))
const clientDistDir = path.resolve(serverDir, '../client/dist')
const MB = 1024 * 1024

export interface BuildDeps {
  config: Config
  pin: string
}

export interface BuiltApp {
  app: FastifyInstance
  sessions: SessionStore
  store: Store
  hub: WsHub
}

const PUBLIC_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/status',
  '/api/health',
])

type RateLimitErrorBuilder = NonNullable<fastifyRateLimit.RateLimitPluginOptions['errorResponseBuilder']>

interface CodedError extends Error {
  statusCode?: number
  code?: ErrorCode
}

function toCodedError(code: ErrorCode, statusCode: number, message: string): CodedError {
  const err = new Error(message) as CodedError
  err.statusCode = statusCode
  err.code = code
  return err
}

const rateLimitError: RateLimitErrorBuilder = (_req, context) =>
  context.ban === true
    ? toCodedError('PIN_BLOCKED', 403, 'Demasiadas tentativas. Aguarda alguns minutos.')
    : toCodedError('RATE_LIMITED', 429, 'Demasiados pedidos. Aguarda um pouco.')

function statusToCode(statusCode: number): ErrorCode {
  switch (statusCode) {
    case 400:
    case 415:
      return 'BAD_INPUT'
    case 401:
      return 'UNAUTHORIZED'
    case 403:
      return 'PIN_BLOCKED'
    case 404:
      return 'NOT_FOUND'
    case 413:
      return 'FILE_TOO_LARGE'
    case 429:
      return 'RATE_LIMITED'
    default:
      return 'INTERNAL'
  }
}

export async function buildApp(deps: BuildDeps): Promise<BuiltApp> {
  const { config } = deps
  const app = Fastify({
    logger: { level: 'info' },
  })

  const sessions = new SessionStoreImpl(config.sessionTtlMs)
  const store = new Store(config.indexFile)
  const hub = new WsHub()

  await app.register(fastifyCookie)
  // Segurança: CSP evita XSS (o feed usa innerHTML para nomes pequenos).
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'font-src': ["'self'"],
        'connect-src': ["'self'", 'ws:', 'wss:'],
        "worker-src": ["'self'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
  await app.register(fastifyRateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    errorResponseBuilder: rateLimitError,
  })
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: config.maxFileBytes,
      files: 1,
      fields: 0,
      parts: 3,
    },
  })

  // maxPayload pequeno: o cliente nunca envia dados (só frames de controlo).
  await app.register(fastifyWebsocket, { options: { maxPayload: 1024 } })

  const hasDist = fs.existsSync(path.join(clientDistDir, 'index.html'))
  if (hasDist) {
    const noCache = new Set(['/index.html', '/sw.js', '/manifest.webmanifest'])
    await app.register(fastifyStatic, {
      root: clientDistDir,
      prefix: '/',
      setHeaders(reply, filePath) {
        if (noCache.has('/' + path.relative(clientDistDir, filePath).replaceAll('\\', '/'))) {
          reply.raw.setHeader('Cache-Control', 'no-cache')
        }
      },
    })
  }

  const storeForLog = { mb: Math.round(config.maxFileBytes / MB) }

  // Sessão exigida em qualquer rota /api (excepto públicas) e no upgrade /ws.
  app.addHook('preHandler', async (req, reply) => {
    const url = req.url.split('?')[0] ?? ''
    if (!url.startsWith('/api') && !url.startsWith('/ws')) return
    if (PUBLIC_PATHS.has(url)) return
    const token = req.cookies?.[SESSION_COOKIE]
    if (typeof token === 'string' && sessions.get(token)) return
    return reply.code(401).send(makeError('UNAUTHORIZED', 'Sessão inválida ou expirada.'))
  })

  await authRoutes(app, { config, pin: deps.pin, sessions })
  await messageRoutes(app, { store, maxTextLen: config.maxTextLen, hub })
  await historyRoutes(app, { store, historyLimit: config.historyLimit })
  await uploadRoutes(app, {
    store,
    hub,
    uploadDir: config.uploadDir,
    tmpDir: config.tmpDir,
    maxFileBytes: config.maxFileBytes,
    minFreeDiskBytes: config.minFreeDiskBytes,
  })
  await filesRoutes(app, { store, uploadDir: config.uploadDir })
  await wsRoutes(app, { store, hub, historyLimit: config.historyLimit })

  app.get('/api/health', async () => ({ ok: true, maxFileMb: storeForLog.mb }))

  // Normaliza todos os erros no formato {error:{code,message}}.
  app.setErrorHandler((err: CodedError, req, reply) => {
    if (err.code && err.statusCode) {
      if (err.statusCode >= 500) req.log.error({ err }, 'Erro interno')
      else req.log.info({ code: err.code }, 'Pedido recusado')
      return reply.code(err.statusCode).send(makeError(err.code, err.message))
    }
    if (err.statusCode && err.statusCode < 500) {
      return reply.code(err.statusCode).send(makeError(statusToCode(err.statusCode), err.message))
    }
    req.log.error({ err }, 'Erro interno')
    return reply.code(500).send(makeError('INTERNAL', 'Erro interno no servidor.'))
  })

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/ws')) {
      return reply.code(404).send(makeError('NOT_FOUND', 'Rota não encontrada'))
    }
    if (hasDist) {
      return reply.sendFile('index.html')
    }
    return reply
      .code(404)
      .send(makeError('NOT_FOUND', 'Cliente não compilado. Corre "npm run build".'))
  })

  return { app, sessions, store, hub }
}