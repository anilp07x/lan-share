import type { Message } from './types.ts'

export class AuthError extends Error {}
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

async function parseError(status: number, body: string): Promise<never> {
  let code = 'UNKNOWN'
  let message = `Erro ${status}`
  try {
    const parsed: unknown = JSON.parse(body)
    if (parsed && typeof parsed === 'object' && 'error' in parsed) {
      const err = (parsed as { error: { code?: string; message?: string } }).error
      if (typeof err.code === 'string') code = err.code
      if (typeof err.message === 'string') message = err.message
    }
  } catch {
    /* corpo não-JSON */
  }
  if (status === 401) throw new AuthError(message)
  throw new HttpError(status, code, message)
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) await parseError(res.status, await res.text())
  return (await res.json()) as T
}

export function isAuthError(err: unknown): err is AuthError {
  return err instanceof AuthError
}

export function errorMessage(err: unknown): string {
  if (err instanceof HttpError || err instanceof AuthError) return err.message
  if (err instanceof Error) return err.message
  return 'Erro inesperado.'
}

// ── auth ──────────────────────────────────────────────────────────────

export function authStatus(): Promise<{ authenticated: boolean }> {
  return request<{ authenticated: boolean }>('/api/auth/status')
}

export function login(pin: string): Promise<{ ok: true }> {
  return request<{ ok: true }>('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
}

export function logout(): Promise<{ ok: true }> {
  return request<{ ok: true }>('/api/auth/logout', { method: 'POST' })
}

// ── mensagens ─────────────────────────────────────────────────────────

export function fetchHistory(): Promise<{ messages: Message[] }> {
  return request<{ messages: Message[] }>('/api/history')
}

export function postMessage(body: string): Promise<{ message: Message }> {
  return request<{ message: Message }>('/api/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body }),
  })
}

export function fileUrl(fileId: string, inline = false): string {
  return `/api/files/${fileId}${inline ? '?inline=1' : ''}`
}

// ── upload (XHR para progresso real; fetch não expõe progresso) ───────

export interface UploadProgress {
  sent: number
  total: number
  percent: number
}

export function uploadFile(
  file: File,
  onProgress: (p: UploadProgress) => void,
  signal: AbortSignal,
): Promise<{ message: Message }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/upload')
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        const percent = Math.min(100, Math.round((ev.loaded / ev.total) * 100))
        onProgress({ sent: ev.loaded, total: ev.total, percent })
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new HttpError(xhr.status, 'UNKNOWN', 'Resposta inválida do servidor.'))
        }
        return
      }
      void parseError(xhr.status, xhr.responseText).catch((err: unknown) => reject(err))
    }
    xhr.onerror = () => reject(new HttpError(0, 'NETWORK', 'Falha de rede ao enviar.'))
    xhr.onabort = () => reject(new DOMException('Envio cancelado.', 'AbortError'))
    signal.addEventListener('abort', () => xhr.abort())

    const fd = new FormData()
    fd.append('file', file)
    xhr.send(fd)
  })
}