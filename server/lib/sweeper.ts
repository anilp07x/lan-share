import { promises as fsp } from 'node:fs'
import path from 'node:path'
import type { Store } from './store.ts'
import type { FileMessage, Message } from '../types.ts'
import { removeQuiet } from './disk.ts'

export interface SweepPaths {
  uploadDir: string
  tmpDir: string
  retentionMs: number
}

export interface SweepResult {
  messagesRemoved: number
  filesRemoved: string[]
  partsRemoved: number
  orphansRemoved: number
}

type LogFn = (message: string) => void

const noopLog: LogFn = () => {}

function fileIdsOf(messages: Message[]): string[] {
  return messages.filter((m): m is FileMessage => m.kind === 'file').map((m) => m.file.fileId)
}

/**
 * Reconciliação completa (no arranque):
 * 1. apaga `.part` sobras; 2. apaga ficheiros sem referência no índice;
 * 3. remove entradas do índice sem ficheiro; 4. aplica retenção.
 * Persiste o índice uma única vez e devolve o resumo.
 */
export async function reconcileData(paths: SweepPaths, store: Store, log: LogFn = noopLog): Promise<SweepResult> {
  await fsp.mkdir(paths.uploadDir, { recursive: true })
  await fsp.mkdir(paths.tmpDir, { recursive: true })

  const result: SweepResult = { messagesRemoved: 0, filesRemoved: [], partsRemoved: 0, orphansRemoved: 0 }

  // 1. Sobras de uploads (.part) — só são limpas aqui, no arranque.
  let tmpNames: string[] = []
  try {
    tmpNames = await fsp.readdir(paths.tmpDir)
  } catch {
    tmpNames = []
  }
  for (const name of tmpNames) {
    const done = await removeQuiet(path.join(paths.tmpDir, name), log)
    if (done) result.partsRemoved++
  }

  // 2. Ficheiros em disco sem referência no índice (órfãos).
  let diskNames: string[] = []
  try {
    diskNames = await fsp.readdir(paths.uploadDir)
  } catch {
    diskNames = []
  }
  const filesOnDisk = new Set(diskNames)
  filesOnDisk.delete('tmp')

  const referenced = new Set(store.allFileMessages().map((m) => m.file.fileId))
  for (const name of filesOnDisk) {
    if (!referenced.has(name)) {
      const done = await removeQuiet(path.join(paths.uploadDir, name), log)
      if (done) result.orphansRemoved++
    }
  }

  // 3. Entradas do índice cujo ficheiro já não existe.
  const missing = store.allFileMessages().filter((m) => !filesOnDisk.has(m.file.fileId))
  if (missing.length > 0) {
    const missingSet = new Set(missing.map((m) => m.file.fileId))
    const removed = store.removeMessagesWhere((m) => m.kind === 'file' && missingSet.has(m.file.fileId))
    result.messagesRemoved += removed.length
  }

  // 4. Retenção: mensagens mais antigas que o limite; apaga os ficheiros.
  if (paths.retentionMs > 0) {
    const cutoff = Date.now() - paths.retentionMs
    const expired = store.removeMessagesWhere((m) => m.ts < cutoff)
    const expiredIds = fileIdsOf(expired)
    for (const fileId of expiredIds) {
      const done = await removeQuiet(path.join(paths.uploadDir, fileId), log)
      if (done) result.filesRemoved.push(fileId)
    }
    result.messagesRemoved += expired.length
  }

  await store.save()
  return result
}

/**
 * Sweep periódico: aplica retenção e apaga ficheiros expirados.
 * Devolve os fileIds removidos (para broadcast "file-expired").
 * Nunca toca em `.part` (podem pertencer a uploads em curso).
 */
export async function sweepExpired(paths: SweepPaths, store: Store, log: LogFn = noopLog): Promise<string[]> {
  if (paths.retentionMs <= 0) return []
  const cutoff = Date.now() - paths.retentionMs
  const removed = store.removeMessagesWhere((m) => m.ts < cutoff)
  if (removed.length === 0) return []
  const fileIds = fileIdsOf(removed)
  for (const fileId of fileIds) {
    await removeQuiet(path.join(paths.uploadDir, fileId), log)
  }
  await store.save()
  return fileIds
}