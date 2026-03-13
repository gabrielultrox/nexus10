const RECOVERY_STORAGE_KEY = 'nexus.runtime-recovery-attempt';
const RECOVERY_TTL_MS = 15000;
const HARD_RECOVERY_PARAM = 'nexus-recover';

function getErrorMessage(errorLike) {
  if (!errorLike) {
    return '';
  }

  if (typeof errorLike === 'string') {
    return errorLike;
  }

  if (typeof errorLike?.message === 'string') {
    return errorLike.message;
  }

  return String(errorLike);
}

function shouldRecoverFromError(errorLike) {
  const message = getErrorMessage(errorLike).toLowerCase();

  return [
    'failed to fetch dynamically imported module',
    'importing a module script failed',
    'loading chunk',
    'chunkloaderror',
    'dynamically imported module',
  ].some((token) => message.includes(token));
}

function canAttemptRecovery() {
  try {
    const lastAttempt = Number(window.sessionStorage.getItem(RECOVERY_STORAGE_KEY) ?? 0);
    return !lastAttempt || (Date.now() - lastAttempt) > RECOVERY_TTL_MS;
  } catch {
    return true;
  }
}

function markRecoveryAttempt() {
  try {
    window.sessionStorage.setItem(RECOVERY_STORAGE_KEY, String(Date.now()));
  } catch (error) {
    console.warn('Nao foi possivel registrar tentativa de recovery.', error);
  }
}

async function resetPwaState() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((registration) => registration.unregister()));
    }

    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.allSettled(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
    }
  } catch (error) {
    console.warn('Nao foi possivel limpar o estado offline antes do recovery.', error);
  }
}

function buildRecoveryUrl() {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set(HARD_RECOVERY_PARAM, Date.now().toString());
  return nextUrl.toString();
}

async function reloadApp({ hardReset = false } = {}) {
  if (!canAttemptRecovery()) {
    return;
  }

  markRecoveryAttempt();

  if (hardReset) {
    await resetPwaState();
    window.location.replace(buildRecoveryUrl());
    return;
  }

  window.location.reload();
}

export function setupRuntimeRecovery() {
  if (typeof window === 'undefined' || window.__nexusRuntimeRecoveryInstalled) {
    return;
  }

  window.__nexusRuntimeRecoveryInstalled = true;

  if (window.location.search.includes(`${HARD_RECOVERY_PARAM}=`)) {
    const sanitizedUrl = new URL(window.location.href);
    sanitizedUrl.searchParams.delete(HARD_RECOVERY_PARAM);
    window.history.replaceState({}, '', sanitizedUrl.toString());
  }

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault?.();
    reloadApp({ hardReset: true });
  });

  window.addEventListener('error', (event) => {
    if (shouldRecoverFromError(event.error ?? event.message)) {
      reloadApp({ hardReset: true });
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (shouldRecoverFromError(event.reason)) {
      event.preventDefault?.();
      reloadApp({ hardReset: true });
    }
  });
}
