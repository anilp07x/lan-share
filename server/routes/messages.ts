import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import type { Store } from '../lib/store.ts'
import type { WsHub } from '../ws/hub.ts'
import { makeError } from '../types.ts'
import { removeQuiet } from '../lib/disk.ts'
import { sanitizeRecipients, sanitizeSender } from '../lib/sanitize.ts'

export interface MessageDeps {
  store: Store
  maxTextLen: number
  hub: WsHub
  uploadDir: string
}

export async function messageRoutes(app: FastifyInstance, deps: MessageDeps): Promise<void> {
  app.post('/api/messages', async (req, reply) => {
    const body = (req.body ?? {}) as {
      body?: unknown
      from?: { id?: unknown; name?: unknown }
      to?: unknown
      replyTo?: unknown
    }
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

    const from = sanitizeSender(body.from?.id, body.from?.name)
    // Sem remetente, o próprio autor deixaria de ver o envio privado.
    const to = sanitizeRecipients(body.to, deps.hub.nameOf)
    if (to === null || (to && !from)) {
      return reply.code(400).send(makeError('BAD_INPUT', 'Destinatários inválidos.'))
    }
    // A mensagem citada pode já ter expirado: nesse caso a resposta segue sem citação.
    const replyTo = typeof body.replyTo === 'string' && deps.store.get(body.replyTo) ? body.replyTo : undefined

    const message = deps.store.addText(Date.now(), clean, from, { to, replyTo })
    await deps.store.save()
    deps.hub.broadcastMessage(message)
    return reply.code(201).send({ message })
  })

  // Só o dispositivo que enviou pode apagar (identidade local: proteção contra
  // enganos, não contra quem conhece o id de outro dispositivo).
  app.delete('/api/messages/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const message = deps.store.get(id)
    if (!message) {
      return reply.code(404).send(makeError('NOT_FOUND', 'Este envio já não existe.'))
    }
    const senderId = req.headers['x-sender-id']
    if (!message.from || message.from.id !== senderId) {
      return reply.code(403).send(makeError('FORBIDDEN', 'Só quem enviou pode apagar.'))
    }

    deps.store.removeMessagesWhere((m) => m.id === id)
    await deps.store.save()
    if (message.kind === 'file') {
      await removeQuiet(path.join(deps.uploadDir, message.file.fileId), (msg) => app.log.warn(msg))
    }
    deps.hub.broadcast({ t: 'deleted', id })
    return reply.send({ ok: true })
  })
}
