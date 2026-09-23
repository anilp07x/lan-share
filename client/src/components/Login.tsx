import { useState } from 'react'
import { authStatus, errorMessage, isAuthError, login } from '../api.ts'

interface LoginProps {
  onAuthed: () => void
}

export default function Login({ onAuthed }: LoginProps) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
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
        setError(`${errorMessage(err)} (podes voltar a tentar mais tarde.)`)
      } else {
        setError('Não consigo chegar ao servidor. Confirma o URL e que o computador está ligado.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <h1>LAN Share</h1>
        <p className="login-hint">
          Pede o PIN a quem tem a LAN Share aberta neste computador.
        </p>
        <form onSubmit={submit} className="login-form">
          <input
            className={`pin-input ${pin.length === 6 ? 'pin-full' : ''}`}
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
          />
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || pin.length !== 6}>
            {busy ? 'A entrar…' : 'Entrar'}
          </button>
        </form>
        {error ? <p className="login-error" role="alert">{error}</p> : null}
      </div>
    </div>
  )
}