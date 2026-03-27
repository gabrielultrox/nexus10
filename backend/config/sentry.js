import * as Sentry from '@sentry/node'

import { backendEnv } from './env.js'
import { logger, serializeError } from '../logging/logger.js'

let sentryInitialized = false

function resolveStoreId(request) {
  return (
    request?.params?.storeId ??
    request?.body?.storeId ??
    request?.authUser?.defaultStoreId ??
    request?.authUser?.storeIds?.[0] ??
    null
  )
}

function resolveMerchantId(request) {
  return request?.params?.merchantId ?? request?.body?.merchantId ?? null
}

function resolveUserId(request) {
  return request?.authUser?.uid ?? null
}

function applyRequestScope(scope, request) {
  if (!request) {
    return
  }

  const userId = resolveUserId(request)
  const storeId = resolveStoreId(request)
  const merchantId = resolveMerchantId(request)
  const requestId = request.id ?? request.headers?.['x-request-id'] ?? null

  if (requestId) {
    scope.setTag('request_id', String(requestId))
  }

  if (storeId) {
    scope.setTag('store_id', String(storeId))
  }

  if (merchantId) {
    scope.setTag('merchant_id', String(merchantId))
  }

  if (userId) {
    scope.setUser({
      id: String(userId),
    })
    scope.setTag('user_id', String(userId))
  }

  scope.setContext('request', {
    method: request.method,
    path: request.originalUrl,
    route: request.route?.path ?? request.path ?? request.originalUrl ?? null,
    ip_address: request.ip ?? request.socket?.remoteAddress ?? null,
  })
}

function applyContextEntries(scope, context) {
  Object.entries(context).forEach(([key, value]) => {
    if (value == null || key === 'request') {
      return
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      scope.setTag(key, String(value))
      return
    }

    scope.setContext(key, value)
  })
}

export function isSentryEnabled() {
  return Boolean(backendEnv.sentryDsn)
}

export function initializeSentry() {
  if (sentryInitialized || !isSentryEnabled()) {
    return
  }

  Sentry.init({
    dsn: backendEnv.sentryDsn,
    enabled: true,
    environment: backendEnv.appEnv,
    release: backendEnv.sentryRelease || undefined,
    tracesSampleRate: backendEnv.sentryTracesSampleRate,
    sendDefaultPii: false,
    integrations: [Sentry.httpIntegration(), Sentry.expressIntegration()],
    initialScope: {
      tags: {
        service: 'nexus10-backend',
      },
    },
  })

  sentryInitialized = true

  logger.info(
    {
      context: 'monitoring.sentry.init',
      tracesSampleRate: backendEnv.sentryTracesSampleRate,
      environment: backendEnv.appEnv,
      release: backendEnv.sentryRelease || null,
    },
    'Sentry monitoring initialized',
  )
}

export function sentryRequestContextMiddleware(request, _response, next) {
  if (!isSentryEnabled()) {
    next()
    return
  }

  initializeSentry()

  const requestId = String(request.id ?? request.headers['x-request-id'] ?? 'unknown')
  Sentry.setTag('request_id', requestId)

  const storeId = resolveStoreId(request)
  const merchantId = resolveMerchantId(request)
  const userId = resolveUserId(request)

  if (storeId) {
    Sentry.setTag('store_id', String(storeId))
  }

  if (merchantId) {
    Sentry.setTag('merchant_id', String(merchantId))
  }

  if (userId) {
    Sentry.setTag('user_id', String(userId))
    Sentry.setUser({ id: String(userId) })
  }

  next()
}

export function setupExpressSentry(app) {
  if (!isSentryEnabled()) {
    return
  }

  initializeSentry()
  Sentry.setupExpressErrorHandler(app)
}

export function captureError(error, context = {}) {
  if (!isSentryEnabled()) {
    return null
  }

  initializeSentry()

  Sentry.withScope((scope) => {
    if (context.request) {
      applyRequestScope(scope, context.request)
    }

    applyContextEntries(scope, context)
    Sentry.captureException(error instanceof Error ? error : new Error('Unknown monitored error'))
  })

  return true
}

export function captureMessage(message, context = {}, level = 'warning') {
  if (!isSentryEnabled()) {
    return null
  }

  initializeSentry()

  Sentry.withScope((scope) => {
    if (context.request) {
      applyRequestScope(scope, context.request)
    }

    applyContextEntries(scope, context)
    Sentry.captureMessage(message, level)
  })

  return true
}

export async function flushSentry(timeout = 2000) {
  if (!isSentryEnabled()) {
    return false
  }

  initializeSentry()
  return Sentry.flush(timeout)
}

export function buildMonitoredErrorPayload(error, context = {}) {
  return {
    ...context,
    error: serializeError(error),
  }
}
