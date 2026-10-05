import * as React from 'react'
import { cn } from '@/lib/utils'

function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<'div'> & {
  orientation?: 'horizontal' | 'vertical'
  decorative?: boolean
}) {
  return (
    <div
      data-slot="separator"
      data-orientation={orientation}
      role={decorative ? 'none' : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        'bg-border shrink-0',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  )
}

/** Linha com texto opcional ao centro — "ou", hints, etc. */
function SeparatorLabel({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="separator-label"
      className={cn('text-muted-foreground flex items-center gap-3 text-xs', className)}
      {...props}
    >
      <Separator className="flex-1" />
      {children ? <span className="shrink-0">{children}</span> : null}
      <Separator className="flex-1" />
    </div>
  )
}

export { Separator, SeparatorLabel }
