import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.tsx'
import type { FileMessage, TextMessage } from '../types.ts'
import { formatTime } from '../lib/format.ts'
import { useCopied } from '../hooks/useCopied.ts'
import { cn } from '../lib/utils.ts'
import { toast } from '../lib/toast.tsx'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.tsx'
import { Message, MessageContent, MessageFooter } from './ui/message.tsx'
import { Bubble, BubbleContent } from './ui/bubble.tsx'
import Attachment from './Attachment.tsx'

export default function MessageItem({ message }: { message: TextMessage | FileMessage }) {
  if (message.kind === 'text') return <TextItem message={message} />
  return <FileItem message={message} />
}

function TextItem({ message }: { message: TextMessage }) {
  const { copied, copy } = useCopied()
  const [flash, setFlash] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  async function onCopy() {
    const ok = await copy(message.body)
    if (!ok) {
      toast.error('Não consegui copiar. Selecciona o texto manualmente.')
      return
    }
    setFlash(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setFlash(false), 1200)
  }

  return (
    <Message className="group max-w-[min(100%,540px)]">
      <MessageContent>
        {/* ghost = sem fundo nem padding: mantém o aspecto de "transcrição partilhada" */}
        <Bubble variant="ghost" align="start">
          <BubbleContent
            className={cn(
              'text-[17px] leading-relaxed break-words whitespace-pre-wrap transition-colors',
              flash && 'text-primary',
            )}
          >
            {message.body}
          </BubbleContent>
        </Bubble>

        {/* meta: hora + copiar. O botão só aparece no hover em ponteiro fino;
            em toque fica sempre visível (senão seria inalcançável). */}
        <MessageFooter className="px-0">
          <time
            className="text-muted-foreground pl-1 tabular-nums"
            dateTime={new Date(message.ts).toISOString()}
          >
            {formatTime(message.ts)}
          </time>

          <Tooltip>
            <TooltipTrigger>
              <button
                type="button"
                onClick={() => void onCopy()}
                disabled={copied}
                aria-label={copied ? 'Texto copiado' : 'Copiar texto'}
                className={cn(
                  'text-muted-foreground hover:text-foreground hover:bg-accent flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] transition-colors',
                  'focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
                  'disabled:pointer-events-none',
                  // ponteiro fino: só no hover/foco; toque: sempre visível
                  '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100',
                  flash && 'text-success opacity-100',
                )}
              >
                {copied ? <Icon name="check" className="text-success size-3" /> : <Icon name="copy" className="size-3" />}
                <span className="sr-only sm:not-sr-only">{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Copiar texto</TooltipContent>
          </Tooltip>
        </MessageFooter>
      </MessageContent>
    </Message>
  )
}

function FileItem({ message }: { message: FileMessage }) {
  return (
    <Message className="max-w-[min(94%,540px)]">
      <MessageContent className="gap-1">
        <Attachment file={message.file} />
        <MessageFooter className="px-0">
          <time
            className="text-muted-foreground pl-1 tabular-nums"
            dateTime={new Date(message.ts).toISOString()}
          >
            {formatTime(message.ts)}
          </time>
        </MessageFooter>
      </MessageContent>
    </Message>
  )
}
