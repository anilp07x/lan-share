import crypto from 'node:crypto'

export function generatePin(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
}

/** Comparação do PIN em tempo constante (evita timing attacks). */
export function pinsEqual(input: string, expected: string): boolean {
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}