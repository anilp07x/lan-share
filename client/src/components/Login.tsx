import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Icon, { type IconName } from './Icon.tsx'
import { authStatus, errorMessage, isAuthError, login } from '../api.ts'
import { prefersReducedMotion } from '../lib/motion.ts'
import { Alert, AlertDescription } from './ui/alert.tsx'
import { Badge } from './ui/badge.tsx'
import { Button } from './ui/button.tsx'
import { Card, CardContent } from './ui/card.tsx'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from './ui/input-otp.tsx'
import { Spinner } from './ui/spinner.tsx'

interface LoginProps {
  onAuthed: () => void
}

const PIN_LENGTH = 6

interface Feature {
  icon: IconName
  title: string
  hint: string
}

const FEATURES: Feature[] = [
  { icon: 'zap', title: 'Instantâneo', hint: 'Mensagens e ficheiros sem espera.' },
  { icon: 'cloud-off', title: '100% offline', hint: 'Nada sai da tua rede local.' },
  { icon: 'users', title: 'Sem contas', hint: 'Um PIN de 6 dígitos e pronto.' },
]

export default function Login({ onAuthed }: LoginProps) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const errRef = useRef<HTMLDivElement>(null)
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reduced = prefersReducedMotion()

  useEffect(
    () => () => {
      if (doneTimer.current) clearTimeout(doneTimer.current)
    },
    [],
  )

  // treme o cartão quando o PIN é recusado
  useEffect(() => {
    const el = errRef.current
    if (!error || !el || reduced) return
    el.classList.remove('animate-shake')
    void el.offsetWidth
    el.classList.add('animate-shake')
  }, [error, reduced])

  // foco automático no PIN quando se recusa (para o utilizador repetir sem clicar)
  useEffect(() => {
    if (!error || busy) return
    const input = document.querySelector<HTMLInputElement>('[data-slot="input-otp"]')
    input?.focus()
  }, [error, busy])

  const progress = useMemo(() => `${pin.length}/${PIN_LENGTH}`, [pin.length])

  async function authenticate(code: string) {
    if (busy || code.length !== PIN_LENGTH) return
    setBusy(true)
    setError(null)
    try {
      await login(code)
      const { authenticated } = await authStatus()
      if (!authenticated) throw new Error('Sessão não criada pelo servidor.')
      setDone(true)
      // deixa o selo de sucesso respirar antes de trocar de ecrã
      doneTimer.current = setTimeout(() => onAuthed(), reduced ? 0 : 420)
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

  const remaining = PIN_LENGTH - pin.length

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      {/* ── fundo: aurora + grelha ───────────────────────────────────── */}
      <div
        aria-hidden="true"
        className={`aurora pointer-events-none absolute inset-0 ${reduced ? '' : 'animate-aurora'}`}
      />
      <div aria-hidden="true" className="aurora-grid pointer-events-none absolute inset-0 opacity-60" />

      {/* ── topo: marca ──────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <div className="text-primary flex size-8 items-center justify-center rounded-lg">
            <Icon name="share" className="size-5" strokeWidth={2} />
          </div>
          <span className="text-sm font-semibold tracking-tight">LAN Share</span>
        </div>
        <Badge variant="secondary" className="gap-1.5 font-normal">
          <span className="bg-success size-1.5 rounded-full" />
          Rede local
        </Badge>
      </header>

      {/* ── centro ───────────────────────────────────────────────────── */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-10 sm:px-6">
        <div className="grid w-full max-w-4xl items-center gap-10 lg:grid-cols-[1fr_auto] lg:gap-16">
          {/* painel esquerdo: a promessa do produto (só em ecrãs grandes) */}
          <section className="hidden lg:block">
            <h1 className="text-4xl font-semibold tracking-tight text-balance">
              Partilha o que importa,
              <br />
              <span className="text-gradient">dentro da tua rede.</span>
            </h1>
            <p className="text-muted-foreground mt-4 max-w-md text-balance">
              Sem contas, sem nuvens, sem uploads lentos. Só um PIN e os ficheiros voam entre os
              dispositivos da tua casa.
            </p>
            <ul className="mt-8 space-y-4">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="flex items-start gap-3">
                  <span className="bg-primary/12 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <Icon name={feature.icon} className="size-4" />
                  </span>
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{feature.title}</span>
                    <span className="text-muted-foreground block text-sm">{feature.hint}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* painel direito: o cartão de login */}
          <Card
            className={`glass-card relative w-full max-w-[26rem] overflow-hidden border py-8 ${
              reduced ? '' : 'animate-rise-in'
            }`}
          >
            {done && !reduced ? <div aria-hidden="true" className="sheen absolute inset-0" /> : null}

            <CardContent className="space-y-6">
              {/* selo: lock → shield check quando o PIN é aceite */}
              <div className="flex flex-col items-center gap-4 text-center">
                <div
                  className={`brand-ring relative flex size-14 items-center justify-center rounded-2xl p-px transition-transform duration-300 ${
                    done ? 'scale-110' : ''
                  } ${done && !reduced ? 'animate-success-pop' : ''}`}
                >
                  <div className="bg-card flex size-full items-center justify-center rounded-[calc(var(--radius)*2-1px)]">
                    {done ? (
                      <svg viewBox="0 0 24 24" fill="none" className="text-success size-7">
                        <path
                          d="M20 6 9 17l-5-5"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="check-draw"
                        />
                      </svg>
                    ) : (
                      <Icon name="lock" className="text-primary size-6" strokeWidth={1.9} />
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {done ? 'Sessão iniciada' : 'Bem-vindo de volta'}
                  </h2>
                  <p className="text-muted-foreground text-sm text-balance" aria-live="polite">
                    {done
                      ? 'A abrir o teu espaço partilhado…'
                      : 'Pede o PIN a quem tem a LAN Share aberta neste computador.'}
                  </p>
                </div>
              </div>

              {done ? null : (
                <>
                  {/* PIN */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        PIN de {PIN_LENGTH} dígitos
                      </span>
                      <span
                        aria-live="polite"
                        className="text-muted-foreground/70 font-mono text-xs tabular-nums"
                      >
                        {progress}
                      </span>
                    </div>

                    <InputOTP
                      value={pin}
                      maxLength={PIN_LENGTH}
                      inputMode="numeric"
                      pattern="^[0-9]*$"
                      autoFocus
                      disabled={busy}
                      aria-label="PIN de acesso"
                      onComplete={(value) => void authenticate(value)}
                      onChange={(value) => {
                        setError(null)
                        setPin(value)
                      }}
                      containerClassName="justify-between gap-1.5"
                      className="disabled:cursor-not-allowed"
                    >
                      <InputOTPGroup className="w-full justify-between gap-1.5">
                        {Array.from({ length: PIN_LENGTH }, (_, i) => (
                          <Fragment key={i}>
                            {i === PIN_LENGTH / 2 ? (
                              <InputOTPSeparator className="text-muted-foreground/40 h-4 w-4 shrink-0 opacity-60" />
                            ) : null}
                            <InputOTPSlot
                              index={i}
                              className={`size-11 flex-1 rounded-xl text-lg font-semibold tabular-nums transition-colors first:rounded-l-xl last:rounded-r-xl sm:size-12 ${
                                !reduced && pin.length === i && !busy ? 'animate-slot-hint' : ''
                              }`}
                            />
                          </Fragment>
                        ))}
                      </InputOTPGroup>
                    </InputOTP>

                    <p className="text-muted-foreground flex min-h-4 items-center gap-1.5 text-xs">
                      {busy ? (
                        <>
                          <Spinner className="size-3.5" />
                          A validar o PIN…
                        </>
                      ) : remaining > 0 ? (
                        <>
                          <Icon name="keyboard" className="size-3.5 shrink-0 opacity-70" />
                          Faltam {remaining} {remaining === 1 ? 'dígito' : 'dígitos'} — ou cola o PIN
                          completo.
                        </>
                      ) : (
                        <>
                          <Icon name="check" className="text-success size-3.5 shrink-0" />
                          PIN completo, a validar…
                        </>
                      )}
                    </p>
                  </div>

                  {/* erro */}
                  {error ? (
                    <div ref={errRef}>
                      <Alert variant="destructive" className="gap-1 py-2.5">
                        <Icon name="alert-circle" />
                        <AlertDescription className="text-[13px] leading-snug">{error}</AlertDescription>
                      </Alert>
                    </div>
                  ) : null}

                  <Button
                    type="button"
                    size="lg"
                    disabled={busy || pin.length !== PIN_LENGTH}
                    className="group h-11 w-full gap-2"
                    onClick={() => void authenticate(pin)}
                  >
                    {busy ? (
                      <>
                        <Spinner />
                        A entrar…
                      </>
                    ) : (
                      <>
                        Entrar
                        <Icon
                          name="arrow-right"
                          className="transition-transform duration-200 group-hover:translate-x-0.5"
                        />
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* ── rodapé: confiança ────────────────────────────────────────── */}
      <footer className="relative z-10 flex items-center justify-center gap-4 px-5 py-5 sm:gap-8">
        <span className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
          <Icon name="shield" className="size-3.5" />
          Sessão encriptada
        </span>
        <span aria-hidden="true" className="bg-border h-3.5 w-px" />
        <span className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
          <Icon name="wifi-off" className="size-3.5" />
          Funciona sem internet
        </span>
      </footer>
    </div>
  )
}
