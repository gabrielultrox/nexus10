import { registerSW } from 'virtual:pwa-register';

export function registerPwa() {
  const updateServiceWorker = registerSW({
    immediate: true,
    onOfflineReady() {
      console.info('[PWA] App pronto para uso offline.');
    },
    onNeedRefresh() {
      console.info('[PWA] Nova versao disponivel. Atualizando o app automaticamente.');
      updateServiceWorker(true);
    },
  });

  return updateServiceWorker;
}
