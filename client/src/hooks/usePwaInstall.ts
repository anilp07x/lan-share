import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
    appinstalled: Event
  }
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

export interface PwaInstall {
  /** o browser já ofereceu instalar a app */
  canInstall: boolean
  /** a app acabou de ser instalada */
  installed: boolean
  /** a plataforma suporta beforeinstallprompt (Chrome/Edge/Android) */
  supported: boolean
  install: () => Promise<InstallOutcome>
}

/**
 * Instalação da PWA via beforeinstallprompt.
 * No Safari iOS o evento não existe — aí o caminho é "Adicionar ao ecrã principal".
 */
export function usePwaInstall(): PwaInstall {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const onPrompt = (e: BeforeInstallPromptEvent) => {
      // escondemos a mini-infobar nativa para controlarmos o momento do convite
      e.preventDefault()
      setDeferred(e)
    }
    const onInstalled = () => {
      setDeferred(null)
      setInstalled(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferred) return 'unavailable'
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    setDeferred(null) // o evento só pode ser usado uma vez
    return outcome
  }, [deferred])

  const supported = typeof window !== 'undefined' && 'onbeforeinstallprompt' in window

  return { canInstall: deferred !== null, installed, supported, install }
}