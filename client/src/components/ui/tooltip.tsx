import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import { prefersReducedMotion } from '@/lib/motion.ts'

type Side = 'top' | 'bottom' | 'left' | 'right'

const SIDE_POS: Record<Side, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2 origin-bottom',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2 origin-top',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2 origin-right',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2 origin-left',
}

interface TooltipCtx {
  open: boolean
  contentId: string
  /** abre após o atraso (hover) */
  show: () => void
  /** abre já (foco/teclado) */
  showNow: () => void
  hide: () => void
}

const Ctx = createContext<TooltipCtx | null>(null)

/** delay partilhado por todos os tooltips da app */
const DelayCtx = createContext(350)

function useCtx(): TooltipCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('Tooltip subcomponentes têm de estar dentro de <Tooltip>')
  return ctx
}

interface TooltipProviderProps {
  children: ReactNode
  delayDuration?: number
}

/** Define o atraso de abertura para todos os tooltips abaixo dele. */
function TooltipProvider({ children, delayDuration = 350 }: TooltipProviderProps) {
  return <DelayCtx.Provider value={delayDuration}>{children}</DelayCtx.Provider>
}

interface TooltipProps {
  children: ReactNode
  delayDuration?: number
}

function Tooltip({ children, delayDuration }: TooltipProps) {
  const inherited = useContext(DelayCtx)
  const delay = delayDuration ?? inherited
  const [open, setOpen] = useState(false)
  const contentId = useId()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  const show = useCallback(() => {
    clear()
    timer.current = setTimeout(() => setOpen(true), delay)
  }, [clear, delay])

  const showNow = useCallback(() => {
    clear()
    setOpen(true)
  }, [clear])

  const hide = useCallback(() => {
    clear()
    setOpen(false)
  }, [clear])

  useEffect(() => clear, [clear])

  const value = useMemo(
    () => ({ open, contentId, show, showNow, hide }),
    [open, contentId, show, showNow, hide],
  )

  return (
    <Ctx.Provider value={value}>
      <span
        data-slot="tooltip-root"
        className="relative inline-flex"
        onKeyDown={(e) => {
          if (e.key === 'Escape') hide()
        }}
      >
        {children}
      </span>
    </Ctx.Provider>
  )
}

interface TooltipTriggerProps extends ComponentProps<'span'> {
  children: ReactNode
}

function TooltipTrigger({ children, className, ...props }: TooltipTriggerProps) {
  const ctx = useCtx()
  return (
    <span
      data-slot="tooltip-trigger"
      className={cn('inline-flex', className)}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') ctx.show()
        props.onPointerEnter?.(e)
      }}
      onPointerLeave={(e) => {
        ctx.hide()
        props.onPointerLeave?.(e)
      }}
      onPointerDown={() => ctx.hide()}
      onFocusCapture={() => ctx.showNow()}
      onBlurCapture={() => ctx.hide()}
      aria-describedby={ctx.open ? ctx.contentId : undefined}
      {...props}
    >
      {children}
    </span>
  )
}

interface TooltipContentProps extends ComponentProps<'span'> {
  side?: Side
}

function TooltipContent({ side = 'top', className, children, ...props }: TooltipContentProps) {
  const ctx = useCtx()
  const reduced = prefersReducedMotion()
  if (!ctx.open) return null

  return (
    <span
      data-slot="tooltip-content"
      id={ctx.contentId}
      role="tooltip"
      className={cn(
        'bg-primary text-primary-foreground pointer-events-none absolute z-50 w-max max-w-56 rounded-md px-2.5 py-1.5 text-xs leading-snug font-medium shadow-lg',
        SIDE_POS[side],
        !reduced && 'animate-tooltip-in',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
export type { Side as TooltipSide }