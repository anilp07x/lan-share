import { Check, Copy } from 'lucide-react'
import type { Message } from '../types.ts'
import { formatTime } from '../lib/format.ts'
import { cn } from '../lib/utils.ts'
import { useCopied } from '../hooks/useCopied.ts'
import { Button } from './ui/button.tsx'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.tsx'
import Attachment from './Attachment.tsx'

export default function MessageItem({ message }: { message: Message }) {
  const { copied, copy } = useCopied()

  if (message.kind === 'text') {
    return (
      <div className="group flex max-w-[min(78%,480px)] flex-col gap-1">
        <div className="bg-card text-card-foreground rounded-2xl rounded-bl-md border px-3.5 py-2.5 shadow-sm">
          <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{message.body}</p>
        </div>
        <div className="flex items-center gap-1 pr-1">
          <time className="text-muted-foreground text-[11px]">{formatTime(message.ts)}</time>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="-ml-1 h-6 gap-1 px-1.5 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => void copy(message.body)}
                disabled={copied}
              >
                {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copiar texto</TooltipContent>
          </Tooltip>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('group flex flex-col gap-1')}>
      <div className="max-w-[min(94%,540px)]">
        <Attachment file={message.file} />
      </div>
      <div className="flex items-center gap-1 pr-1">
        <time className="text-muted-foreground text-[11px]">{formatTime(message.ts)}</time>
      </div>
    </div>
  )
}