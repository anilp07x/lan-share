import { createContext, useContext, useEffect, useId, useMemo, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/components/Icon.tsx'
import { cn } from '@/lib/utils'
import { Slot } from '@/lib/slot.tsx'
import { prefersReducedMotion } from '@/lib/motion.ts'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

interface DialogCtx {
  open: boolean
  onOpenChange: (open: boolean) => void
  titleId: string
  closable: boolean
}

const Ctx = createContext<DialogCtx | null>(null)

function useCtx() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('Dialog subcomponentes têm de estar dentro de <Dialog>')
  return ctx
}

function Dialog({ open, onOpenChange, children, closable = true }: DialogProps & { closable?: boolean }) {
  const titleId = useId()
  const value = useMemo(
    () => ({ open, onOpenChange, titleId, closable }),
    [open, onOpenChange, titleId, closable],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

type ButtonWithChildProps = { children: ReactNode; asChild?: boolean } & React.ComponentProps<'button'>

function DialogTrigger({ children, asChild = false, onClick, ...props }: ButtonWithChildProps) {
  const ctx = useCtx()
  const handler = () => ctx.onOpenChange(true)
  if (asChild) {
    return (
      <Slot onClick={onClick ?? handler} {...props}>
        {children}
      </Slot>
    )
  }
  return (
    <button type="button" onClick={handler} {...props}>
      {children}
    </button>
  )
}

function DialogClose({ children, asChild = false, onClick, ...props }: ButtonWithChildProps) {
  const ctx = useCtx()
  const handler = () => ctx.onOpenChange(false)
  if (asChild) {
    return (
      <Slot onClick={onClick ?? handler} {...props}>
        {children}
      </Slot>
    )
  }
  return (
    <button type="button" onClick={handler} {...props}>
      {children}
    </button>
  )
}

function DialogPortal() {
  return null
}

function useLock(open: boolean) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
}

function DialogOverlay({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-overlay" className={cn('absolute inset-0 bg-black/60 backdrop-blur-sm', className)} aria-hidden="true" {...props} />
}

function DialogContent({ className, children, ...props }: React.ComponentProps<'div'>) {
  const ctx = useCtx()
  const ref = useRef<HTMLDivElement>(null)
  const reduced = prefersReducedMotion()
  useLock(ctx.open)

  useEffect(() => {
    if (!ctx.open) return undefined
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        return ctx.onOpenChange(false)
      }
      if (e.key === 'Tab' && ref.current) {
        const focusables = Array.from(
          ref.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
          ),
        )
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (!first || !last) return
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [ctx.open, ctx.onOpenChange])

  if (!ctx.open) return null

  return createPortal(
    <div data-slot="dialog-root" className="fixed inset-0 z-50 grid place-items-center p-4">
      <DialogOverlay />
      <div
        ref={ref}
        data-slot="dialog-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={ctx.titleId}
        tabIndex={-1}
        className={cn(
          'bg-background text-foreground relative z-10 max-h-[86dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-border p-6 focus:outline-none',
          !reduced && 'animate-dialog-in',
          className,
        )}
        {...props}
      >
        {children}
        {ctx.closable && (
          <button
            type="button"
            onClick={() => ctx.onOpenChange(false)}
            aria-label="Fechar"
            className="text-muted-foreground absolute top-4 right-4 flex size-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Icon name="x" className="size-4" />
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-header" className={cn('flex flex-col gap-1.5', className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  const ctx = useCtx()
  return (
    <h2
      id={ctx.titleId}
      data-slot="dialog-title"
      className={cn('text-lg leading-none font-semibold', className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="dialog-description" className={cn('text-muted-foreground text-sm', className)} {...props} />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}