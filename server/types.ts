export interface FileMeta {
  fileId: string
  name: string
  size: number
  mime: string
}

/** Dispositivo que enviou a mensagem (identidade local, não autenticada). */
export interface Sender {
  id: string
  name: string
}

export interface TextMessage {
  id: string
  ts: number
  kind: 'text'
  body: string
  from?: Sender
  /** Só estes dispositivos (e o remetente) veem a mensagem; ausente = todos. */
  to?: Sender[]
  /** Id da mensagem a que esta responde. */
  replyTo?: string
}

export interface FileMessage {
  id: string
  ts: number
  kind: 'file'
  file: FileMeta
  from?: Sender
  to?: Sender[]
}

export type Message = TextMessage | FileMessage

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'PIN_INVALID'
  | 'PIN_BLOCKED'
  | 'RATE_LIMITED'
  | 'BAD_INPUT'
  | 'TEXT_EMPTY'
  | 'TEXT_TOO_LONG'
  | 'FILE_TOO_LARGE'
  | 'NO_FILE'
  | 'TOO_MANY_FILES'
  | 'DISK_FULL'
  | 'INTERNAL'
  | 'NOT_FOUND'
  | 'FORBIDDEN'

export interface ApiError {
  error: { code: ErrorCode; message: string }
}

export function makeError(code: ErrorCode, message: string): ApiError {
  return { error: { code, message } }
}

export type WsFrame =
  | { t: 'history'; messages: Message[] }
  | { t: 'message'; message: Message }
  | { t: 'file-expired'; fileId: string }
  | { t: 'deleted'; id: string }
  | { t: 'presence'; peers: Sender[] }
  | { t: 'error'; code: ErrorCode; message: string }