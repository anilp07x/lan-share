export const FILE_NAME_MAX = 200

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