import * as Sentry from '@sentry/react'

import { clientEnv } from './env'
import type { IUserSession } from '../hooks/useAuth'

let frontendSentryInitialized = false

function shouldEnableReplay() {
  return (
    clientEnv.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE > 0 ||
    clientEnv.VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE > 0
  )
}

export function isFrontendSentryEnabled() {
  return Boolean(clientEnv.VITE_SENTRY_DSN)
}

export function initializeFrontendSentry() {
  if (frontendSentryInitialized || !isFrontendSentryEnabled()) {
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
    release: clientEnv.VITE_SENTRY_RELEASE || undefined,
    tracesSampleRate: clientEnv.VITE_SENTRY_TRACES_SAMPLE_RATE,
    replaysSessionSampleRate: clientEnv.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE,
    replaysOnErrorSampleRate: clientEnv.VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE,
    integrations,
    initialScope: {
      tags: {
        service: 'nexus10-frontend',
      },
    },
  })

  frontendSentryInitialized = true

  if (typeof window !== 'undefined') {
    window.__NEXUS10_SENTRY_TEST__ = () =>
      captureFrontendError(new Error('Nexus10 frontend Sentry smoke test'), {
        feature: 'sentry',
        action: 'manual-test',
      })
  }
}

export function setFrontendSentryUser(session: IUserSession | null) {
  if (!frontendSentryInitialized) {
    return
  }

  if (!session) {
    Sentry.setUser(null)
    Sentry.setTag('user_id', '')
    Sentry.setTag('user_role', '')
    return
  }

  Sentry.setUser({
    id: session.uid,
    username: session.operatorName || session.displayName,
    email: session.email ?? undefined,
  })
  Sentry.setTag('user_id', session.uid)
  Sentry.setTag('user_role', session.role)
}

export function setFrontendSentryStore(storeId: string | null) {
  if (!frontendSentryInitialized) {
    return
  }

  Sentry.setTag('store_id', storeId ?? '')
}

export function captureFrontendError(error: unknown, context: Record<string, unknown> = {}) {
  if (!isFrontendSentryEnabled()) {
    return null
  }

  initializeFrontendSentry()

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

  return true
}

declare global {
  interface Window {
    __NEXUS10_SENTRY_TEST__?: () => void
  }
}
