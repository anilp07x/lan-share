import type { ReactNode } from 'react'
import { cn } from '../lib/utils.ts'
import { prefersReducedMotion } from '../lib/motion.ts'

interface RevealProps {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
}

/** Entrada suave (fade + deslize) quando o elemento monta, via CSS. */
export default function Reveal({ children, delay = 0, y = 10, className }: RevealProps) {
  if (prefersReducedMotion()) {
    return <div className={className}>{children}</div>
  }
  return (
    <div
      className={cn('animate-reveal', className)}
      style={{ animationDelay: `${delay}s`, ['--reveal-y' as string]: `${y}px` }}
    >
      {children}
    </div>
  )
}