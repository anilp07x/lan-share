import type { ReactNode } from 'react'

const URL_RE = /\b(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi
const TRAILING = /[.,;:!?)\]}'"»]+$/

/** Texto com links clicáveis (sem HTML: só nós React). */
export default function Linkify({ text, query }: { text: string; query?: string }) {
  const out: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index
    let url = match[0]
    const trail = TRAILING.exec(url)?.[0] ?? ''
    url = url.slice(0, url.length - trail.length)
    if (start > last) out.push(<Highlight key={`t${last}`} text={text.slice(last, start)} query={query} />)
    out.push(
      <a
        key={`a${start}`}
        href={url.startsWith('www.') ? `https://${url}` : url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-signal-ink decoration-signal-ink/40 hover:decoration-signal-ink font-medium break-all underline underline-offset-[3px]"
      >
        {url}
      </a>,
    )
    last = start + url.length
  }
  if (last < text.length) out.push(<Highlight key={`t${last}`} text={text.slice(last)} query={query} />)
  return <>{out}</>
}

/** Marca as ocorrências da pesquisa. */
export function Highlight({ text, query }: { text: string; query?: string }) {
  const q = query?.trim()
  if (!q) return <>{text}</>
  const lower = text.toLocaleLowerCase('pt')
  const needle = q.toLocaleLowerCase('pt')
  const parts: ReactNode[] = []
  let i = 0
  let at = lower.indexOf(needle)
  while (at !== -1) {
    if (at > i) parts.push(text.slice(i, at))
    parts.push(
      <mark key={at} className="bg-signal-wash text-foreground rounded-[3px]">
        {text.slice(at, at + needle.length)}
      </mark>,
    )
    i = at + needle.length
    at = lower.indexOf(needle, i)
  }
  if (i < text.length) parts.push(text.slice(i))
  return <>{parts}</>
}
