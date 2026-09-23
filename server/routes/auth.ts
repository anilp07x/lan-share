import type { FastifyInstance } from 'fastify'
import type { Config } from '../config.ts'
import type { SessionStore } from '../lib/sessions.ts'
import { pinsEqual } from '../lib/auth.ts'
import { makeError } from '../types.ts'

export const SESSION_COOKIE = 'lan_share_session'

export interface AuthDeps {
  config: Config
  pin: string
  sessions: SessionStore
}

export async function authRoutes(app: FastifyInstance, deps: AuthDeps): Promise<void> {
  const { config, pin, sessions } = deps

  app.post(
    '/api/auth/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '5 minutes',
          ban: 0,
          continueExceeding: true,
        },
      },
    },
    async (req, reply) => {
      const body = (req.body ?? {}) as { pin?: unknown }
      const input = body.pin
      if (typeof input !== 'string' || !/^\d{6}$/.test(input)) {
        return reply.code(400).send(makeError('BAD_INPUT', 'O PIN deve ter 6 dígitos.'))
      }
      if (!pinsEqual(input, pin)) {
        return reply.code(401).send(makeError('PIN_INVALID', 'PIN incorrecto.'))
      }
      const { token } = sessions.create()
      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        maxAge: Math.floor(config.sessionTtlMs / 1000),
      })
      return reply.send({ ok: true })
    },
  )

  app.get(
    '/api/auth/status',
    { config: { rateLimit: false } },
    async (req) => {
      const token = req.cookies?.[SESSION_COOKIE]
      return { authenticated: typeof token === 'string' && sessions.get(token) !== null }
    },
  )

  app.post(
    '/api/auth/logout',
    { config: { rateLimit: false } },
    async (req, reply) => {
      const token = req.cookies?.[SESSION_COOKIE]
      if (token) sessions.delete(token)
      reply.clearCookie(SESSION_COOKIE, { path: '/' })
      return reply.send({ ok: true })
    },
  )
}