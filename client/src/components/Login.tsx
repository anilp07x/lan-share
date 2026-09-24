import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import gsap from 'gsap'
import { LockKeyhole } from 'lucide-react'
import { authStatus, errorMessage, isAuthError, login } from '../api.ts'
import { prefersReducedMotion } from '../lib/motion.ts'
import { cn } from '../lib/utils.ts'
import { Button } from './ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.tsx'
import { Input } from './ui/input.tsx'
import { Label } from './ui/label.tsx'

interface LoginProps {
  onAuthed: () => void
}

export default function Login({ onAuthed }: LoginProps) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const errRef = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el || prefersReducedMotion()) return
    const anim = gsap.fromTo(
      el,
      { opacity: 0, y: 18, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power3.out' },
    )
    return () => {
      anim.kill()
    }
  }, [])

  useEffect(() => {
    const el = errRef.current
    if (!error || !el) return
    gsap.fromTo(el, { x: -8 }, { x: 0, duration: 0.35, ease: 'elastic.out(1, 0.4)' })
  }, [error])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || pin.length !== 6) return
    setBusy(true)
    setError(null)
    try {
      await login(pin)
      const { authenticated } = await authStatus()
      if (!authenticated) throw new Error('Sessão não criada pelo servidor.')
      onAuthed()
    } catch (err) {
      if (isAuthError(err)) {
        setError(`${errorMessage(err)} Podes voltar a tentar mais tarde.`)
      } else {
        setError('Não consigo chegar ao servidor. Confirma o URL e que o computador está ligado.')
      }
    } finally {
      setBusy(false)
    }
  }

  const full = pin.length === 6

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,rgba(79,140,255,0.08),transparent_60%)] p-6">
      <Card ref={cardRef} className="w-full max-w-sm py-8">
        <CardHeader className="items-center gap-3 text-center">
          <div className="bg-primary/15 text-primary flex size-12 items-center justify-center rounded-2xl">
            <LockKeyhole className="size-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-2xl tracking-tight">LAN Share</CardTitle>
            <CardDescription>
              Pede o PIN a quem tem a LAN Share aberta neste computador.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pin" className="sr-only">
                PIN de 6 dígitos
              </Label>
              <Input
                id="pin"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                aria-label="PIN de 6 dígitos"
                autoFocus
                disabled={busy}
                className={cn(
                  'text-center text-3xl font-semibold tracking-[0.5em] placeholder:tracking-[0.5em]',
                  full && 'border-success text-success',
                )}
              />
            </div>
            <Button type="submit" disabled={busy || pin.length !== 6} className="w-full py-2 text-base">
              {busy ? 'A entrar…' : 'Entrar'}
            </Button>
            {error ? (
              <p ref={errRef} role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
                {error}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}