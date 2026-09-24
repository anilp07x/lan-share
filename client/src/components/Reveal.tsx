import { useLayoutEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { MOTION_EASE, MOTION_MS, prefersReducedMotion } from '../lib/motion.ts'

interface RevealProps {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
}

/** Entrada suave (fade + deslize) quando o elemento monta. */
export default function Reveal({ children, delay = 0, y = 10, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const anim = gsap.fromTo(
      el,
      { opacity: 0, y },
      { opacity: 1, y: 0, duration: MOTION_MS / 1000, delay, ease: MOTION_EASE, clearProps: 'transform' },
    )
    return () => {
      anim.kill()
    }
  }, [delay, y])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}