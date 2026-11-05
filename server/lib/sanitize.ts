import type { Sender } from '../types.ts'

export const FILE_NAME_MAX = 200
export const SENDER_NAME_MAX = 40
export const RECIPIENTS_MAX = 20
const SENDER_ID_RE = /^[A-Za-z0-9_-]{8,64}$/

/** Valida a identidade do dispositivo; devolve undefined se inválida. */
export function sanitizeSender(rawId: unknown, rawName: unknown): Sender | undefined {
  if (typeof rawId !== 'string' || !SENDER_ID_RE.test(rawId)) return undefined
  if (typeof rawName !== 'string') return undefined
  const name = rawName
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SENDER_NAME_MAX)
  if (name.length === 0) return undefined
  return { id: rawId, name }
}

/**
 * Destinatários de um envio privado: lista (ou texto separado por vírgulas) de ids.
 * Ids inválidos invalidam tudo — um envio privado nunca deve cair para "todos".
 * Devolve undefined se não houver destinatários, null se a lista for inválida.
 */
export function sanitizeRecipients(raw: unknown, nameOf: (id: string) => string | undefined): Sender[] | undefined | null {
  if (raw === undefined || raw === null || raw === '') return undefined
  const ids = typeof raw === 'string' ? raw.split(',') : raw
  if (!Array.isArray(ids) || ids.length > RECIPIENTS_MAX) return null
  const unique = [...new Set(ids)]
  if (!unique.every((id): id is string => typeof id === 'string' && SENDER_ID_RE.test(id))) return null
  if (unique.length === 0) return undefined
  return unique.map((id) => ({ id, name: nameOf(id) ?? 'Dispositivo' }))
}

/**
 * Nome para exibição/metadados. Nunca usado como caminho em disco.
 * Remove caracteres de controlo e caracteres proibidos em caminhos Windows.
 */
export function sanitizeDisplayName(raw: string): string {
  let name = String(raw)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()

  if (name.length === 0) return 'ficheiro'

  if (name.length > FILE_NAME_MAX) {
    const dot = name.lastIndexOf('.')
    const ext = dot > 0 && dot < name.length - 1 ? name.slice(dot) : ''
    const base = dot > 0 ? name.slice(0, dot) : name
    const baseLimit = Math.max(1, FILE_NAME_MAX - ext.length)
    name = base.slice(0, baseLimit) + ext
  }

  return name
}

/** Percent-encoding UTF-8 no subconjunto seguro do RFC 5987 (attr-char). */
function rfc5987Encode(value: string): string {
  const safe = /[A-Za-z0-9!#$&+.^_`|~-]/
  const encoder = new TextEncoder()
  let out = ''
  for (const ch of value) {
    if (safe.test(ch)) {
      out += ch
    } else {
      out += Array.from(encoder.encode(ch), (b) => `%${b.toString(16).toUpperCase()}`).join('')
    }
  }
  return out
}

/**
 * Cabeçalho Content-Disposition com nome fallback ASCII e filename* (UTF-8).
 * Ex.: attachment; filename="Relat_rio_final__v2_.pdf"; filename*=UTF-8''Relat%C3%B3rio%20final%20(v2).pdf
 */
export function contentDisposition(name: string, inline: boolean): string {
  const mode = inline ? 'inline' : 'attachment'
  const fallback = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'ficheiro'
  const encoded = rfc5987Encode(name)
  return `${mode}; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

export function safeMimeType(mime: string): string {
  const cleaned = String(mime ?? '')
    .replace(/[^\x20-\x7e]/g, '')
    .trim()
  if (/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(cleaned)) return cleaned
  return 'application/octet-stream'
}