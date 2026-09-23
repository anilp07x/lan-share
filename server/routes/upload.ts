import { promises as fsp } from 'node:fs'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import type { FastifyInstance } from 'fastify'
import type { Store } from '../lib/store.ts'
import type { WsHub } from '../ws/hub.ts'
import { freeBytes, removeQuiet, renameRetry } from '../lib/disk.ts'
import { safeMimeType, sanitizeDisplayName } from '../lib/sanitize.ts'
import { makeError } from '../types.ts'

export interface UploadDeps {
  store: Store
  hub: WsHub
  uploadDir: string
  tmpDir: string
  maxFileBytes: number
  minFreeDiskBytes: number
}

const MB = 1024 * 1024

export async function uploadRoutes(app: FastifyInstance, deps: UploadDeps): Promise<void> {
  const { store, hub, uploadDir, tmpDir } = deps

  app.post('/api/upload', async (req, reply) => {
    const data = await req.file()
    if (!data) {
      return reply.code(400).send(makeError('NO_FILE', 'Nenhum ficheiro enviado.'))
    }

    const fileId = crypto.randomUUID()
    const tmpFile = path.join(tmpDir, `${fileId}.part`)
    const finalFile = path.join(uploadDir, fileId)

    const name = sanitizeDisplayName(typeof data.filename === 'string' ? data.filename : 'ficheiro')
    const mime = safeMimeType(data.mimetype)

    // Pré-verificação de espaço (o Content-Length inclui todo o corpo multipart).
    const contentLength = Number(req.headers['content-length'] ?? 0)
    if (contentLength > 0) {
      const free = await freeBytes(uploadDir)
      if (free < deps.minFreeDiskBytes + contentLength) {
        return reply.code(507).send(makeError('DISK_FULL', 'Sem espaço suficiente em disco para este ficheiro.'))
      }
    }

    let committed = false
    try {
      const out = createWriteStream(tmpFile, { flags: 'wx' })
      await pipeline(data.file, out)

      if (data.file.truncated) {
        return reply
          .code(413)
          .send(makeError('FILE_TOO_LARGE', `Ficheiro excede o limite de ${Math.round(deps.maxFileBytes / MB)} MB.`))
      }

      await renameRetry(tmpFile, finalFile)
      const size = (await fsp.stat(finalFile)).size
      const message = store.addFile(Date.now(), { fileId, name, size, mime })
      await store.save()
      committed = true
      hub.broadcast({ t: 'message', message })
      return reply.code(201).send({ message })
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOSPC') {
        return reply.code(507).send(makeError('DISK_FULL', 'Disco cheio durante o envio.'))
      }
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 413 || code === 'FST_MULTIPART_REQUEST_FILE_TOO_LARGE') {
        return reply.code(413).send(makeError('FILE_TOO_LARGE', `Ficheiro excede o limite de ${Math.round(deps.maxFileBytes / MB)} MB.`))
      }
      // Cliente interrompeu o envio ou erro inesperado: o err re-lançado chega
      // ao setErrorHandler (500 genérico) e o `finally` apaga o .part.
      throw err
    } finally {
      if (!committed) await removeQuiet(tmpFile, (msg) => app.log.warn(msg))
    }
  })
}