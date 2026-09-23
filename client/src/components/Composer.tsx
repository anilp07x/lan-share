import { useRef, useState } from 'react'

interface ComposerProps {
  onSendText: (body: string) => Promise<boolean>
  onFiles: (files: File[]) => void
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  )
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.5 6v11.5a4 4 0 0 1-8 0V5a2.5 2.5 0 0 1 5 0v10.5a1 1 0 0 1-2 0V6H10v9.5a2.5 2.5 0 0 0 5 0V5a4 4 0 0 0-8 0v12.5a5.5 5.5 0 0 0 11 0V6h-1.5z" />
    </svg>
  )
}

export default function Composer({ onSendText, onFiles }: ComposerProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (sending || body.length === 0) return
    setSending(true)
    try {
      const ok = await onSendText(body)
      if (ok) setText('')
    } finally {
      setSending(false)
    }
  }

  function onPickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) onFiles(files)
    e.target.value = ''
  }

  function onPaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
    if (files.length > 0) {
      e.preventDefault()
      onFiles(files)
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={onPickerChange}
        aria-label="Escolher ficheiros"
      />
      <button
        type="button"
        className="icon-btn icon-btn-soft"
        onClick={() => inputRef.current?.click()}
        title="Enviar ficheiro"
      >
        <PaperclipIcon />
      </button>

      <textarea
        className="composer-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={onPaste}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void submit(e)
          }
        }}
        rows={1}
        placeholder="Escreve uma mensagem…"
        aria-label="Mensagem"
      />

      <button
        type="submit"
        className="btn btn-primary send-btn"
        disabled={sending || text.trim().length === 0}
        title="Enviar"
      >
        <SendIcon />
      </button>
    </form>
  )
}