export type MessageKind = 'text' | 'file'

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

export interface ApiErrorBody {
  error: { code: string; message: string }
}

export type WsFrame =
  | { t: 'history'; messages: Message[] }
  | { t: 'message'; message: Message }
  | { t: 'file-expired'; fileId: string }
  | { t: 'error'; code: string; message: string }