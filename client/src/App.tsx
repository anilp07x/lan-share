import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './components/Icon.tsx'
import type { Message, Sender, ServerInfo, WsFrame } from './types.ts'
import { authStatus, fetchHistory, fetchInfo, logout } from './api.ts'
import { WsClient, type WsStatus } from './ws.ts'
import { getDevice, useDevice } from './lib/device.ts'
import { useArrivalAlerts } from './lib/alerts.ts'
import Login from './components/Login.tsx'
import Feed from './components/Feed.tsx'
import DeviceNameDialog from './components/DeviceNameDialog.tsx'
import { Toaster } from './lib/toast.tsx'

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
  const [peers, setPeers] = useState<Sender[]>([])
  const [info, setInfo] = useState<ServerInfo | null>(null)
  const [naming, setNaming] = useState(false)
  const [historyReady, setHistoryReady] = useState(false)
  const device = useDevice()
  const wsRef = useRef<WsClient | null>(null)
  useArrivalAlerts(messages, device.id, historyReady)

  const handleFrame = useCallback((frame: WsFrame) => {
    if (frame.t === 'history') {
      setMessages(frame.messages)
      setHistoryReady(true)
      return
    }
    if (frame.t === 'message') {
      setMessages((prev) => mergeMessages(prev, [frame.message]))
      return
    }
    if (frame.t === 'presence') {
      setPeers(frame.peers)
      return
    }
    if (frame.t === 'deleted') {
      setMessages((prev) => prev.filter((m) => m.id !== frame.id))
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
    setHistoryReady(false)
    setAuth('unauthed')
    setMessages([])
    setPeers([])
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

  // O nome mudou: volta a anunciar-se na lista de presença.
  useEffect(() => {
    wsRef.current?.hello({ id: device.id, name: device.name })
  }, [device.id, device.name])

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

  // Autenticado: histórico, info do servidor e WS.
  useEffect(() => {
    if (auth !== 'authed') return
    let cancelled = false
    fetchHistory(getDevice().id)
      .then((data) => {
        if (!cancelled) setMessages((prev) => mergeMessages(prev, data.messages))
      })
      .catch(() => {})
    fetchInfo()
      .then((data) => {
        if (!cancelled) setInfo(data)
      })
      .catch(() => {})
    wsRef.current?.start()
    return () => {
      cancelled = true
    }
  }, [auth])

  // Primeira vez neste dispositivo: pede um nome (o palpite fica se saltar).
  useEffect(() => {
    if (auth === 'authed' && !device.named) setNaming(true)
  }, [auth, device.named])

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

  if (auth === 'loading') {
    return (
      <div className="bg-shell text-shell-foreground flex min-h-dvh flex-col items-center justify-center gap-5">
        <div className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-2xl">
          <Icon name="capsule" className="size-7" />
        </div>
        <p className="tag text-shell-muted flex items-center gap-2 text-sm">
          <Icon name="loader" className="size-4 animate-spin" />A ligar ao servidor
        </p>
      </div>
    )
  }

  if (auth === 'unauthed') {
    return (
      <Login
        onAuthed={() => {
          setMessages([])
          setAuth('authed')
        }}
      />
    )
  }

  return (
    <>
      <Feed
        messages={messages}
        peers={peers}
        info={info}
        wsStatus={wsStatus}
        addMessage={addMessage}
        onAuthFail={onAuthFail}
        onLogout={onLogout}
        onRename={() => setNaming(true)}
      />
      <DeviceNameDialog open={naming} onOpenChange={setNaming} />
      <Toaster />
    </>
  )
}
