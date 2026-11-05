import { useEffect, useState, type FormEvent } from 'react'
import { DEVICE_NAME_MAX, setDeviceName, useDevice } from '../lib/device.ts'
import { Button } from './ui/button.tsx'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog.tsx'

interface DeviceNameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Nome que aparece na guia de cada envio e na lista de estações ligadas. */
export default function DeviceNameDialog({ open, onOpenChange }: DeviceNameDialogProps) {
  const device = useDevice()
  const [value, setValue] = useState(device.name)

  useEffect(() => {
    if (open) setValue(device.name)
  }, [open, device.name])

  function close() {
    // fechar sem guardar confirma o nome atual: não volta a perguntar
    if (!device.named) setDeviceName(device.name)
    onOpenChange(false)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    setDeviceName(value)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Como se chama este dispositivo?</DialogTitle>
          <DialogDescription>
            O nome aparece em cada envio e na lista de estações ligadas, para os outros saberem de onde veio.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="tag text-muted-foreground text-xs">Nome do dispositivo</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={DEVICE_NAME_MAX}
              autoFocus
              autoComplete="off"
              placeholder="Ex.: Telemóvel da Ana"
              className="border-input bg-card focus-visible:border-ring h-12 rounded-xl border px-3.5 text-base outline-none"
            />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={close}>
              {device.named ? 'Cancelar' : 'Manter «' + device.name + '»'}
            </Button>
            <Button type="submit" disabled={value.trim().length === 0}>
              Guardar nome
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
