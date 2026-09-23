import { promises as fsp } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { FileMessage, FileMeta, Message, TextMessage } from '../types.ts'
import { renameRetry } from './disk.ts'

export class IndexCorruptError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IndexCorruptError'
  }
}

function newMessageId(): string {
  return `m_${crypto.randomBytes(8).toString('hex')}`
}

interface IndexFile {
  version?: unknown
  messages?: unknown
}

function isFileMeta(value: unknown): value is FileMeta {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  const validId = typeof v.fileId === 'string' && v.fileId.length > 0
  const validName = typeof v.name === 'string' && v.name.length > 0
  const validSize = typeof v.size === 'number' && Number.isFinite(v.size) && v.size >= 0
  const validMime = typeof v.mime === 'string' && v.mime.length > 0
  return validId && validName && validSize && validMime
}

function isValidMessage(value: unknown): value is Message {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || v.id.length === 0) return false
  if (typeof v.ts !== 'number' || !Number.isFinite(v.ts)) return false
  if (v.kind === 'text') {
    return v.body === undefined || typeof v.body === 'string' || v.body === null
  }
  if (v.kind === 'file') {
    return isFileMeta(v.file)
  }
  return false
}

/** Índice de metadados em memória com persistência atómica em JSON (data/index.json). */
export class Store {
  private messages: Message[] = []
  private fileById = new Map<string, FileMessage>()
  readonly indexFile: string

  constructor(indexFile: string) {
    this.indexFile = indexFile
  }

  get size(): number {
    return this.messages.length
  }

  recentMessages(limit: number): Message[] {
    return this.messages.slice(-limit)
  }

  getFile(fileId: string): FileMessage | undefined {
    return this.fileById.get(fileId)
  }

  allFileMessages(): FileMessage[] {
    return this.messages.filter((m): m is FileMessage => m.kind === 'file')
  }

  addText(ts: number, body: string): TextMessage {
    const message: TextMessage = { id: newMessageId(), ts, kind: 'text', body }
    this.messages.push(message)
    return message
  }

  addFile(ts: number, file: FileMeta): FileMessage {
    const message: FileMessage = { id: newMessageId(), ts, kind: 'file', file }
    this.messages.push(message)
    this.fileById.set(file.fileId, message)
    return message
  }

  /** Remove mensagens que satisfaçam o predicado; devolve as removidas. */
  removeMessagesWhere(predicate: (m: Message) => boolean): Message[] {
    const kept: Message[] = []
    const removed: Message[] = []
    for (const message of this.messages) {
      ;(predicate(message) ? removed : kept).push(message)
    }
    this.messages = kept
    this.fileById = new Map(
      this.messages.filter((m): m is FileMessage => m.kind === 'file').map((m) => [m.file.fileId, m]),
    )
    return removed
  }

  async load(): Promise<void> {
    let raw: string
    try {
      raw = await fsp.readFile(this.indexFile, 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        this.messages = []
        this.fileById = new Map()
        return
      }
      throw err
    }

    let parsed: IndexFile
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new IndexCorruptError(`JSON inválido em ${this.indexFile}`)
    }
    if (typeof parsed !== 'object' || parsed === null) {
      throw new IndexCorruptError(`Estrutura inválida em ${this.indexFile}`)
    }
    if (parsed.version !== 1 || !Array.isArray(parsed.messages)) {
      throw new IndexCorruptError(`Versão/estrutura não suportada em ${this.indexFile}`)
    }

    const valid = parsed.messages.filter(isValidMessage)
    if (valid.length !== parsed.messages.length) {
      throw new IndexCorruptError(
        `Entradas inválidas no índice ${this.indexFile} (${parsed.messages.length - valid.length} removidas)`,
      )
    }

    this.messages = valid
    this.fileById = new Map(
      valid
        .filter((m): m is FileMessage => m.kind === 'file')
        .map((m) => [m.file.fileId, m]),
    )
  }

  async save(): Promise<void> {
    const indexFile = this.indexFile
    await fsp.mkdir(path.dirname(indexFile), { recursive: true })
    const tmp = `${indexFile}.tmp`
    const json = JSON.stringify({ version: 1, messages: this.messages })
    await fsp.writeFile(tmp, json, 'utf8')
    await renameRetry(tmp, indexFile)
  }
}