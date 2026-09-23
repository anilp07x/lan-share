import type { FastifyInstance } from 'fastify'
import type { Store } from '../lib/store.ts'
import type { WsHub } from '../ws/hub.ts'
import { makeError } from '../types.ts'

export interface MessageDeps {
  store: Store
  maxTextLen: number
  hub: WsHub
}

export async function messageRoutes(app: FastifyInstance, deps: MessageDeps): Promise<void> {
  app.post('/api/messages', async (req, reply) => {
    const body = (req.body ?? {}) as { body?: unknown }
    const text = typeof body.body === 'string' ? body.body.trim() : ''
    if (text.length === 0) {
      return reply.code(400).send(makeError('TEXT_EMPTY', 'Escreve uma mensagem antes de enviar.'))
    }
    if (text.length > deps.maxTextLen) {
      return reply
        .code(400)
        .send(makeError('TEXT_TOO_LONG', `Mensagem demasiado longa (máx. ${deps.maxTextLen} caracteres).`))
    }
    // Remove caracteres de controlo (mantém  \n e \t como texto).
    const clean = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')

    const message = deps.store.addText(Date.now(), clean)
    await deps.store.save()
    deps.hub.broadcast({ t: 'message', message })
    return reply.code(201).send({ message })
  })
}