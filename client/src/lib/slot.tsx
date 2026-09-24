import { cloneElement, isValidElement, type ReactElement } from 'react'
import { cn } from './utils.ts'

type AnyProps = Record<string, unknown>

function composeFns<A>(a?: (e: A) => void, b?: (e: A) => void): ((e: A) => void) | undefined {
  if (a && b) return (e) => {
    b(e)
    a(e)
  }
  return a ?? b
}

/** Funde props no primeiro filho (asChild minimalista, sem Radix). */
export function Slot({ children, className, onClick, ...rest }: AnyProps) {
  const child = isValidElement(children) ? (children as ReactElement<AnyProps>) : null
  if (!child) return null
  return cloneElement(child, {
    ...rest,
    ...child.props,
    className: cn(className as string, child.props?.className as string),
    onClick: composeFns(onClick as (e: unknown) => void, child.props?.onClick as (e: unknown) => void),
  })
}