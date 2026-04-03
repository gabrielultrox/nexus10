import { registerSW } from 'virtual:pwa-register'

export function registerPwa() {
  const updateServiceWorker = registerSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (!registration) {
        return
      }

      registration.update().catch((error) => {
        console.warn('[PWA] Nao foi possivel verificar atualizacoes do service worker.', error)
      })
    },
    onOfflineReady() {
      console.info('[PWA] App pronto para uso offline.')
    },
    onNeedRefresh() {
      console.info('[PWA] Nova versao disponivel. A atualizacao sera aplicada na proxima recarga.')
    },
    onRegisterError(error) {
      console.warn('[PWA] Falha ao registrar o modo offline.', error)
    },
  })

  return updateServiceWorker
}
