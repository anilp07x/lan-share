import * as React from 'react'
import { cn } from '@/lib/utils'

interface ProgressProps extends React.ComponentProps<'div'> {
  value?: number | null
  indicatorClassName?: string
}

/** Barra de progresso (role=progressbar, aria-valuenow 0–100). */
function Progress({ className, value, indicatorClassName, ...props }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn('bg-primary/20 relative h-2 w-full overflow-hidden rounded-full', className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={cn('bg-primary h-full flex-1 transition-[width] duration-200 ease-out', indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export { Progress }