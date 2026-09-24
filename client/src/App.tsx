import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Loader2, Share2 } from 'lucide-react'
import type { Message, WsFrame } from './types.ts'
import { authStatus, logout } from './api.ts'
import { WsClient, type WsStatus } from './ws.ts'
import Login from './components/Login.tsx'
import Feed from './components/Feed.tsx'
import { Toaster } from './components/ui/sonner.tsx'
import { TooltipProvider } from './components/ui/tooltip.tsx'

type AuthState = 'loading' | 'unauthed' | 'authed'

/** Junta mensagens por id mantendo ordem cronológica. */
function mergeMessages(a: Message[], b: Message[]): Message[] {
  const byId = new Map<string, Message>()
  for (const m of [...a, ...b]) byId.set(m.id, m)
  return [...byId.values()].sort((x, y) => x.ts - y.ts)
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>('loading')
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting')
  const [messages, setMessages] = useState<Message[]>([])
  const wsRef = useRef<WsClient | null>(null)

  const handleFrame = useCallback((frame: WsFrame) => {
    if (frame.t === 'history') {
      setMessages(frame.messages)
      return
    }
    if (frame.t === 'message') {
      setMessages((prev) => mergeMessages(prev, [frame.message]))
      return
    }
    if (frame.t === 'file-expired') {
      setMessages((prev) => prev.filter((m) => !(m.kind === 'file' && m.file.fileId === frame.fileId)))
    }
  }, [])

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => mergeMessages(prev, [message]))
  }, [])

  const onAuthFail = useCallback(() => {
    wsRef.current?.stop()
    setAuth('unauthed')
    setMessages([])
  }, [])

  const onLogout = useCallback(async () => {
    try {
      await logout()
    } catch {
      /* sessão provavelmente já expirada */
    }
    onAuthFail()
  }, [onAuthFail])

  // Cria o cliente WS (uma vez) e liga os callbacks.
  useEffect(() => {
    const client = new WsClient()
    wsRef.current = client
    client.onStatus = setWsStatus
    client.onFrame = handleFrame
    return () => client.stop()
  }, [handleFrame])

  // Estado inicial: há sessão válida?
  useEffect(() => {
    let cancelled = false
    authStatus()
      .then(({ authenticated }) => {
        if (cancelled) return
        setAuth(authenticated ? 'authed' : 'unauthed')
      })
      .catch(() => {
        if (!cancelled) setAuth('unauthed')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Estar autenticado: histórico + ligar o WS.
  useEffect(() => {
    if (auth !== 'authed') return
    let cancelled = false
    fetch('/api/history')
      .then((res) => (res.ok ? (res.json() as Promise<{ messages: Message[] }>) : Promise.resolve(null)))
      .then((data) => {
        if (cancelled || !data) return
        setMessages((prev) => mergeMessages(prev, data.messages))
      })
      .catch(() => {})
    wsRef.current?.start()
    return () => {
      cancelled = true
    }
  }, [auth])

  // A reconectar há demasiado tempo? Confirma se a sessão ainda existe.
  useEffect(() => {
    if (wsStatus !== 'reconnecting') return
    let cancelled = false
    const timer = setTimeout(() => {
      authStatus()
        .then(({ authenticated }) => {
          if (!cancelled && !authenticated) onAuthFail()
        })
        .catch(() => {})
    }, 3000)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [wsStatus, onAuthFail])

  let screen: React.ReactNode
  if (auth === 'loading') {
    screen = (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[radial-gradient(ellipse_at_top,rgba(79,140,255,0.08),transparent_60%)]">
        <div className="bg-primary/15 text-primary flex size-12 animate-pulse items-center justify-center rounded-2xl">
          <Share2 className="size-6" aria-hidden="true" />
        </div>
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          A carregar…
        </p>
      </div>
    )
  } else if (auth === 'unauthed') {
    screen = (
      <Login
        onAuthed={() => {
          setMessages([])
          setAuth('authed')
        }}
      />
    )
  } else {
    screen = (
      <>
        <Feed
          messages={messages}
          wsStatus={wsStatus}
          addMessage={addMessage}
          onAuthFail={onAuthFail}
          onLogout={onLogout}
        />
        <Toaster />
      </>
    )
  }

  return <TooltipProvider>{screen}</TooltipProvider>
}