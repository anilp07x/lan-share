import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { LockKeyhole } from 'lucide-react'
import { authStatus, errorMessage, isAuthError, login } from '../api.ts'
import { prefersReducedMotion } from '../lib/motion.ts'
import { Button } from './ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.tsx'
import { InputOTP, InputOTPGroup, InputOTPSlot } from './ui/input-otp.tsx'

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

  async function authenticate(code: string) {
    if (busy || code.length !== 6) return
    setBusy(true)
    setError(null)
    try {
      await login(code)
      const { authenticated } = await authStatus()
      if (!authenticated) throw new Error('Sessão não criada pelo servidor.')
      onAuthed()
    } catch (err) {
      if (isAuthError(err)) {
        setError(`${errorMessage(err)} Podes voltar a tentar mais tarde.`)
      } else {
        setError('Não consigo chegar ao servidor. Confirma o URL e que o computador está ligado.')
      }
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card ref={cardRef} className="w-full max-w-sm py-8">
        <CardHeader className="items-center gap-3 text-center">
          <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-xl">
            <LockKeyhole className="size-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-2xl tracking-tight">LAN Share</CardTitle>
            <CardDescription>Pede o PIN a quem tem a LAN Share aberta neste computador.</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <InputOTP
            value={pin}
            maxLength={6}
            inputMode="numeric"
            pattern="^[0-9]*$"
            autoFocus
            disabled={busy}
            onComplete={(value) => void authenticate(value)}
            onChange={(value) => setPin(value)}
            containerClassName="justify-center gap-1.5"
          >
            <InputOTPGroup className="gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} className="size-11 rounded-lg text-lg" />
              ))}
            </InputOTPGroup>
          </InputOTP>

          <Button
            type="button"
            disabled={busy || pin.length !== 6}
            className="w-full py-2 text-base"
            onClick={() => void authenticate(pin)}
          >
            {busy ? 'A entrar…' : 'Entrar'}
          </Button>

          {error ? (
            <p ref={errRef} role="alert" className="text-destructive text-center text-sm">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}