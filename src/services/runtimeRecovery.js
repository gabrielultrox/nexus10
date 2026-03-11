const RECOVERY_STORAGE_KEY = 'nexus.runtime-recovery-attempt';
const RECOVERY_TTL_MS = 15000;

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
  } catch (error) {
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

function reloadApp() {
  if (!canAttemptRecovery()) {
    return;
  }

  markRecoveryAttempt();
  window.location.reload();
}

export function setupRuntimeRecovery() {
  if (typeof window === 'undefined' || window.__nexusRuntimeRecoveryInstalled) {
    return;
  }

  window.__nexusRuntimeRecoveryInstalled = true;

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault?.();
    reloadApp();
  });

  window.addEventListener('error', (event) => {
    if (shouldRecoverFromError(event.error ?? event.message)) {
      reloadApp();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (shouldRecoverFromError(event.reason)) {
      event.preventDefault?.();
      reloadApp();
    }
  });
}
