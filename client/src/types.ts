export type MessageKind = 'text' | 'file'

export interface FileMeta {
  fileId: string
  name: string
  size: number
  mime: string
}

/** Dispositivo que enviou a mensagem. */
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
  /** Envio privado: só estes dispositivos (e o remetente) o veem. */
  to?: Sender[]
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

export interface ApiErrorBody {
  error: { code: string; message: string }
}

export interface ServerInfo {
  primaryUrl: string | null
  urls: string[]
  retentionMs: number
  maxFileMb: number
}

export type WsFrame =
  | { t: 'history'; messages: Message[] }
  | { t: 'message'; message: Message }
  | { t: 'file-expired'; fileId: string }
  | { t: 'deleted'; id: string }
  | { t: 'presence'; peers: Sender[] }
  | { t: 'error'; code: string; message: string }
