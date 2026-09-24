import Icon from './Icon.tsx'
import type { Message } from '../types.ts'
import { formatTime } from '../lib/format.ts'
import { useCopied } from '../hooks/useCopied.ts'
import { Button } from './ui/button.tsx'
import Attachment from './Attachment.tsx'

export default function MessageItem({ message }: { message: Message }) {
  const { copied, copy } = useCopied()

  if (message.kind === 'text') {
    return (
      <div className="group flex max-w-[min(100%,540px)] flex-col gap-0.5">
        <p className="text-[17px] leading-relaxed break-words whitespace-pre-wrap">{message.body}</p>
        <div className="flex items-center gap-1 pr-1">
          <time className="text-muted-foreground text-xs">{formatTime(message.ts)}</time>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-1 h-7 gap-1 px-1.5 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            onClick={() => void copy(message.body)}
            disabled={copied}
            title="Copiar texto"
          >
            {copied ? <Icon name="check" className="size-3 text-success" /> : <Icon name="copy" className="size-3" />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex max-w-[min(94%,540px)] flex-col gap-0.5">
      <Attachment file={message.file} />
      <time className="text-muted-foreground pr-1 text-xs">{formatTime(message.ts)}</time>
    </div>
  )
}