import { promises as fsp } from 'node:fs'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import fastifyStatic from '@fastify/static'
import type { Store } from '../lib/store.ts'
import { contentDisposition } from '../lib/sanitize.ts'
import { makeError } from '../types.ts'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface FilesDeps {
  store: Store
  uploadDir: string
}

export async function filesRoutes(app: FastifyInstance, deps: FilesDeps): Promise<void> {
  // Streaming + Range por id exato ({fileId}); o ficheiro não tem extensão
  // em disco, por isso o Content-Type vem sempre do índice.
  await app.register(fastifyStatic, {
    root: deps.uploadDir,
    wildcard: false,
    decorateReply: false,
  })

  app.get('/api/files/:fileId', async (req, reply) => {
    const params = req.params as { fileId: string }
    const fileId = params.fileId
    if (!UUID_RE.test(fileId)) {
      return reply.code(404).send(makeError('NOT_FOUND', 'Ficheiro não encontrado.'))
    }
    const message = deps.store.getFile(fileId)
    if (!message) {
      return reply.code(404).send(makeError('NOT_FOUND', 'Ficheiro não encontrado.'))
    }

    const query = req.query as { inline?: string }
    const inline = query.inline === '1'
    const isPreviewable = message.file.mime.startsWith('image/')

    reply.header('Content-Disposition', contentDisposition(message.file.name, inline))
    reply.header('X-Content-Type-Options', 'nosniff')
    if (inline && isPreviewable) {
      // Preview: servimos com Content-Type real (sendFile sobreporia octet-stream).
      const { size } = await fsp.stat(path.join(deps.uploadDir, fileId))
      reply.header('Content-Type', message.file.mime)
      reply.header('Content-Length', String(size))
      return reply.send(createReadStream(path.join(deps.uploadDir, fileId)))
    }
    reply.header('Cache-Control', 'private, max-age=3600')
    return reply.sendFile(fileId, deps.uploadDir)
  })
}