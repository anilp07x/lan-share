import { useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import gsap from 'gsap'
import { CornerDownLeft, Paperclip } from 'lucide-react'
import { prefersReducedMotion } from '../lib/motion.ts'
import { Button } from './ui/button.tsx'
import { Textarea } from './ui/textarea.tsx'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.tsx'

interface ComposerProps {
  onSendText: (body: string) => Promise<boolean>
  onFiles: (files: File[]) => void
}

export default function Composer({ onSendText, onFiles }: ComposerProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const pickerRef = useRef<HTMLInputElement>(null)
  const sendRef = useRef<HTMLButtonElement>(null)

  const submit = async (e?: FormEvent | KeyboardEvent): Promise<void> => {
    e?.preventDefault()
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

  function onPickerChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) onFiles(files)
    e.target.value = ''
  }

  function onPaste(e: ClipboardEvent) {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
    if (files.length > 0) {
      e.preventDefault()
      onFiles(files)
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit(e)
      pulseSend()
    }
  }

  function pulseSend() {
    const el = sendRef.current
    if (!el || prefersReducedMotion()) return
    gsap.fromTo(el, { scale: 0.9 }, { scale: 1, duration: 0.25, ease: 'back.out(2)' })
  }

  const canSend = !sending && text.trim().length > 0

  return (
    <div className="border-border bg-background/85 supports-[backdrop-filter]:bg-background/70 border-t px-3 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur">
      <form onSubmit={(e) => void submit(e)} className="flex items-end gap-2">
        <input
          ref={pickerRef}
          type="file"
          multiple
          hidden
          onChange={onPickerChange}
          aria-label="Escolher ficheiros"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="mb-0.5 size-10 shrink-0 rounded-xl"
              onClick={() => pickerRef.current?.click()}
              aria-label="Enviar ficheiro"
            >
              <Paperclip className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Enviar ficheiro</TooltipContent>
        </Tooltip>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Escreve uma mensagem…"
          aria-label="Mensagem"
          className="min-h-10 max-h-32 flex-1 min-w-0 resize-none rounded-xl leading-relaxed"
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              ref={sendRef}
              type="submit"
              size="icon"
              disabled={!canSend}
              className="mb-0.5 size-10 shrink-0 rounded-xl"
              aria-label="Enviar mensagem"
              onClick={() => pulseSend()}
            >
              {sending ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <CornerDownLeft className="size-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Enviar (Enter)</TooltipContent>
        </Tooltip>
      </form>
    </div>
  )
}