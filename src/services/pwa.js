import { registerSW } from 'virtual:pwa-register';

export function registerPwa() {
  let refreshing = false;

  const forceReload = () => {
    if (refreshing || typeof window === 'undefined') {
      return;
    }

    refreshing = true;
    window.location.reload();
  };

  const updateServiceWorker = registerSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (!registration) {
        return;
      }

      registration.update().catch((error) => {
        console.warn('[PWA] Nao foi possivel verificar atualizacoes do service worker.', error);
      });

      navigator.serviceWorker?.addEventListener?.('controllerchange', forceReload, { once: true });
    },
    onOfflineReady() {
      console.info('[PWA] App pronto para uso offline.');
    },
    onNeedRefresh() {
      console.info('[PWA] Nova versao disponivel. Atualizando o app automaticamente.');
      updateServiceWorker(true);
    },
    onRegisterError(error) {
      console.warn('[PWA] Falha ao registrar o modo offline.', error);
    },
  });

  return updateServiceWorker;
}
