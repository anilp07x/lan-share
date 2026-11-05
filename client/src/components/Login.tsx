import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.tsx'
import { authStatus, errorMessage, isAuthError, login } from '../api.ts'
import { prefersReducedMotion } from '../lib/motion.ts'
import { Button } from './ui/button.tsx'
import { InputOTP, InputOTPGroup, InputOTPSlot } from './ui/input-otp.tsx'

interface LoginProps {
  onAuthed: () => void
}

export default function Login({ onAuthed }: LoginProps) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const el = errRef.current
    if (!error || !el || prefersReducedMotion()) return
    el.classList.remove('animate-shake')
    void el.offsetWidth
    el.classList.add('animate-shake')
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
        setError(`${errorMessage(err)} Confirma o PIN no terminal do computador.`)
      } else {
        setError('Não consigo chegar ao servidor. Confirma o endereço e que o computador está ligado.')
      }
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-shell text-shell-foreground flex min-h-dvh flex-col">
      <header className="flex items-center gap-2.5 px-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
          <Icon name="capsule" className="size-[18px]" />
        </div>
        <span className="tag text-shell-muted text-sm">Rede local · sem internet</span>
      </header>

      <main className="flex flex-1 flex-col justify-center px-6 py-10">
        <div className="animate-rise-in mx-auto w-full max-w-md">
          <h1 className="display text-[clamp(3.5rem,16vw,5.5rem)]">
            LAN
            <br />
            Share
          </h1>
          <p className="text-shell-muted mt-4 max-w-xs text-[17px] leading-snug text-pretty">
            Texto e ficheiros entre todos os dispositivos desta rede. Introduz o PIN que aparece no computador.
          </p>

          <div className="bg-card text-card-foreground mt-8 rounded-3xl p-5 sm:p-6">
            <label className="tag text-muted-foreground mb-3 block text-xs" htmlFor="pin">
              PIN de acesso
            </label>
            <InputOTP
              id="pin"
              value={pin}
              maxLength={6}
              inputMode="numeric"
              pattern="^[0-9]*$"
              autoFocus
              disabled={busy}
              onComplete={(value) => void authenticate(value)}
              onChange={(value) => {
                setPin(value)
                if (error) setError(null)
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'pin-error' : undefined}
              containerClassName="gap-2"
            >
              <InputOTPGroup className="grid w-full grid-cols-6 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    aria-invalid={error ? true : undefined}
                    className="bg-muted h-14 w-full rounded-xl border border-transparent text-2xl font-semibold tabular-nums shadow-none first:rounded-xl first:border-l last:rounded-xl data-[active=true]:border-ring data-[active=true]:ring-ring/25"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>

            <Button
              type="button"
              size="lg"
              disabled={busy || pin.length !== 6}
              className="mt-4 w-full"
              onClick={() => void authenticate(pin)}
            >
              {busy ? <Icon name="loader" className="size-4 animate-spin" /> : null}
              {busy ? 'A entrar…' : 'Entrar'}
            </Button>

            {error ? (
              <p ref={errRef} id="pin-error" role="alert" className="text-destructive mt-3 text-center text-sm">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  )
}
