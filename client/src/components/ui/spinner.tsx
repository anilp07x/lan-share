import * as React from 'react'
import Icon from '@/components/Icon.tsx'
import { cn } from '@/lib/utils'

interface SpinnerProps extends Omit<React.ComponentProps<'svg'>, 'name' | 'strokeWidth'> {
  label?: string
}

function Spinner({ className, label, ...props }: SpinnerProps) {
  return (
    <Icon
      name="loader"
      role="status"
      aria-label={label ?? 'A carregar'}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
