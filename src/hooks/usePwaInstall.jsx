import { useEffect, useState } from 'react'

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault()
      setDeferredPrompt(event)
      setIsInstallable(true)
    }

    function handleOnline() {
      setIsOffline(false)
    }

    function handleOffline() {
      setIsOffline(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  async function installApp() {
    if (!deferredPrompt) {
      return null
    }

    await deferredPrompt.prompt()
    const outcome = await deferredPrompt.userChoice

    setDeferredPrompt(null)
    setIsInstallable(false)

    return outcome
  }

  return {
    installApp,
    isInstallable,
    isOffline,
  }
}
