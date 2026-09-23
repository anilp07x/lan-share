export interface FileMeta {
  fileId: string
  name: string
  size: number
  mime: string
}

export interface TextMessage {
  id: string
  ts: number
  kind: 'text'
  body: string
}

export interface FileMessage {
  id: string
  ts: number
  kind: 'file'
  file: FileMeta
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
  | { t: 'error'; code: ErrorCode; message: string }