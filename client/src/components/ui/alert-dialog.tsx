import * as React from 'react'
import Icon from '@/components/Icon.tsx'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx'

interface AlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  )
}

function AlertDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent className={cn('max-w-sm', className)} {...props}>
      {children}
    </DialogContent>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<typeof DialogHeader>) {
  return <DialogHeader className={cn('items-start gap-2', className)} {...props} />
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<typeof DialogFooter>) {
  return <DialogFooter className={cn('mt-2', className)} {...props} />
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof DialogTitle>) {
  return <DialogTitle className={cn('text-base', className)} {...props} />
}

function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof DialogDescription>) {
  return <DialogDescription className={cn('text-balance', className)} {...props} />
}

function AlertDialogAction({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      data-slot="alert-dialog-action"
      className={cn(
        'bg-destructive inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition-colors hover:bg-destructive/90 focus-visible:ring-destructive/50 focus-visible:ring-[3px] focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogCancel({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      data-slot="alert-dialog-cancel"
      className={cn(
        'bg-secondary text-secondary-foreground inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors hover:bg-secondary/80 focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  )
}

/** Ícone de aviso circular, usado acima do título. */
function AlertDialogIcon({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-icon"
      className={cn(
        'bg-destructive/10 text-destructive mb-1 flex size-10 items-center justify-center rounded-full',
        className,
      )}
      {...props}
    >
      <Icon name="logout" className="size-5" />
    </div>
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
}