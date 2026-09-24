import { useCallback, useState } from 'react'
import { copyText } from '../lib/format.ts'

export function useCopied(timeoutMs = 1500): { copied: boolean; copy: (text: string) => Promise<boolean> } {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      const ok = await copyText(text)
      if (ok) {
        setCopied(true)
        window.setTimeout(() => setCopied(false), timeoutMs)
      }
      return ok
    },
    [timeoutMs],
  )

  return { copied, copy }
}