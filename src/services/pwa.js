import { registerSW } from 'virtual:pwa-register';

export function registerPwa() {
  return registerSW({
    immediate: true,
    onOfflineReady() {
      console.info('[PWA] App pronto para uso offline.');
    },
    onNeedRefresh() {
      console.info('[PWA] Nova versão disponível para atualização.');
    },
  });
}
