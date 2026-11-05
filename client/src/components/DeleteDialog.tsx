import { useState } from 'react'
import Icon from './Icon.tsx'
import type { Message } from '../types.ts'
import { deleteMessage, errorMessage, isAuthError } from '../api.ts'
import { getDevice } from '../lib/device.ts'
import { messagePreview } from '../lib/format.ts'
import { toast } from '../lib/toast.tsx'
import { Button } from './ui/button.tsx'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog.tsx'

interface DeleteDialogProps {
  messages: Message[] | null
  onDone: () => void
  onAuthFail: () => void
}

/** Confirma antes de apagar para todos (o servidor avisa os outros por WS). */
export default function DeleteDialog({ messages, onDone, onAuthFail }: DeleteDialogProps) {
  const [busy, setBusy] = useState(false)
  const count = messages?.length ?? 0
  const first = messages?.[0]

  async function confirm() {
    if (!messages) return
    setBusy(true)
    try {
      for (const m of messages) await deleteMessage(m.id, getDevice())
      onDone()
    } catch (err) {
      if (isAuthError(err)) {
        onAuthFail()
        return
      }
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={messages !== null} onOpenChange={(open) => !open && !busy && onDone()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{count > 1 ? `Apagar ${count} imagens?` : 'Apagar este envio?'}</DialogTitle>
          <DialogDescription>Desaparece em todos os dispositivos. Não dá para desfazer.</DialogDescription>
        </DialogHeader>
        {first && count === 1 ? (
          <p className="bg-muted mt-4 line-clamp-3 rounded-xl px-3.5 py-2.5 text-sm break-words">{messagePreview(first)}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onDone} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={busy}>
            {busy ? <Icon name="loader" className="size-4 animate-spin" /> : <Icon name="trash" className="size-4" />}
            Apagar para todos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
