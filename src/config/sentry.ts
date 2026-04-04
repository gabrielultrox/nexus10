import { clientEnv } from './env'
import type { IUserSession } from '../hooks/useAuth'

type FrontendSentryModule = typeof import('@sentry/react')

let frontendSentryInitialized = false
let frontendSentryInitPromise: Promise<void> | null = null
let frontendSentryModulePromise: Promise<FrontendSentryModule | null> | null = null
let pendingFrontendSentryUser: IUserSession | null = null
let pendingFrontendSentryStoreId: string | null = null

const FALLBACK_FRONTEND_RELEASE =
  typeof __NEXUS10_RELEASE__ !== 'undefined' ? __NEXUS10_RELEASE__ : ''

function shouldEnableReplay() {
  return (
    clientEnv.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE > 0 ||
    clientEnv.VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE > 0
  )
}

function loadFrontendSentryModule() {
  if (!isFrontendSentryEnabled()) {
    return Promise.resolve(null)
  }

  if (!frontendSentryModulePromise) {
    frontendSentryModulePromise = import('@sentry/react').catch(() => null)
  }

  return frontendSentryModulePromise
}

function applyPendingFrontendScope(Sentry: FrontendSentryModule) {
  if (!frontendSentryInitialized) {
    return
  }

  if (!pendingFrontendSentryUser) {
    Sentry.setUser(null)
    Sentry.setTag('user_id', '')
    Sentry.setTag('user_role', '')
  } else {
    Sentry.setUser({
      id: pendingFrontendSentryUser.uid,
      username: pendingFrontendSentryUser.operatorName ?? pendingFrontendSentryUser.displayName,
      email: pendingFrontendSentryUser.email ?? undefined,
    })
    Sentry.setTag('user_id', pendingFrontendSentryUser.uid)
    Sentry.setTag('user_role', pendingFrontendSentryUser.role)
  }

  Sentry.setTag('store_id', pendingFrontendSentryStoreId ?? '')
}

export function isFrontendSentryEnabled() {
  return Boolean(clientEnv.VITE_SENTRY_DSN)
}

export function initializeFrontendSentry() {
  if (frontendSentryInitialized) {
    return
  }

  if (frontendSentryInitPromise || !isFrontendSentryEnabled()) {
    return
  }

  frontendSentryInitPromise = loadFrontendSentryModule()
    .then((Sentry) => {
      if (!Sentry || frontendSentryInitialized) {
        return
      }

      const integrations: any[] = [Sentry.browserTracingIntegration()]

      if (shouldEnableReplay()) {
        integrations.push(Sentry.replayIntegration())
      }

      Sentry.init({
        dsn: clientEnv.VITE_SENTRY_DSN,
        enabled: true,
        environment: clientEnv.VITE_APP_ENV,
        release: clientEnv.VITE_SENTRY_RELEASE || FALLBACK_FRONTEND_RELEASE || undefined,
        tracesSampleRate: clientEnv.VITE_SENTRY_TRACES_SAMPLE_RATE,
        replaysSessionSampleRate: clientEnv.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE,
        replaysOnErrorSampleRate: clientEnv.VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE,
        integrations: integrations as Parameters<FrontendSentryModule['init']>[0]['integrations'],
        initialScope: {
          tags: {
            service: 'nexus10-frontend',
          },
        },
      })

      frontendSentryInitialized = true
      applyPendingFrontendScope(Sentry)

      if (typeof window !== 'undefined') {
        window.__NEXUS10_SENTRY_TEST__ = () =>
          captureFrontendError(new Error('Nexus10 frontend Sentry smoke test'), {
            feature: 'sentry',
            action: 'manual-test',
          })
      }
    })
    .finally(() => {
      if (!frontendSentryInitialized) {
        frontendSentryModulePromise = null
      }

      frontendSentryInitPromise = null
    })
}

export function setFrontendSentryUser(session: IUserSession | null) {
  pendingFrontendSentryUser = session

  if (!isFrontendSentryEnabled()) {
    return
  }

  initializeFrontendSentry()

  if (!frontendSentryInitialized) {
    return
  }

  void loadFrontendSentryModule().then((Sentry) => {
    if (!Sentry) {
      return
    }

    applyPendingFrontendScope(Sentry)
  })
}

export function setFrontendSentryStore(storeId: string | null) {
  pendingFrontendSentryStoreId = storeId

  if (!isFrontendSentryEnabled()) {
    return
  }

  initializeFrontendSentry()

  if (!frontendSentryInitialized) {
    return
  }

  void loadFrontendSentryModule().then((Sentry) => {
    if (!Sentry) {
      return
    }

    applyPendingFrontendScope(Sentry)
  })
}

export function captureFrontendError(error: unknown, context: Record<string, unknown> = {}) {
  if (!isFrontendSentryEnabled()) {
    return null
  }

  initializeFrontendSentry()

  void loadFrontendSentryModule().then((Sentry) => {
    if (!Sentry || !frontendSentryInitialized) {
      return
    }

    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        if (value == null) {
          return
        }

        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          scope.setTag(key, String(value))
          return
        }

        scope.setContext(key, value as Record<string, unknown>)
      })

      Sentry.captureException(error instanceof Error ? error : new Error(String(error)))
    })
  })

  return true
}

declare global {
  interface Window {
    __NEXUS10_SENTRY_TEST__?: () => void
  }
}

declare const __NEXUS10_RELEASE__: string | undefined
