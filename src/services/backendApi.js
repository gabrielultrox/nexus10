import {
  buildBackendResponseError,
  buildOfflineNetworkError,
  buildTimeoutError,
  captureErrorForMonitoring,
  createOfflineQueuedError,
  enqueueOfflineRequest,
  flushOfflineRequestQueue,
  getOfflineQueueCount,
  retryWithBackoff,
} from './apiErrorHandler'
import { ensureRemoteSession, firebaseReady } from './firebase'
import { recordApiLatencyMetric } from './frontendMetrics'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '')

async function resolveAuthorizationHeader(options = {}) {
  let authorizationHeader = options.headers?.Authorization ?? options.headers?.authorization ?? null

  if (!authorizationHeader && firebaseReady && !options.skipAuth) {
    const user = await ensureRemoteSession().catch(() => null)
    const idToken = user ? await user.getIdToken().catch(() => '') : ''

    if (idToken) {
      authorizationHeader = `Bearer ${idToken}`
    }
  }

  return authorizationHeader
}

async function parseResponse(response, path, method) {
  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : {}

  if (!response.ok) {
    throw buildBackendResponseError(payload, response.status, { path, method })
  }

  return payload.data ?? payload
}

async function dispatchBackendRequest(path, options = {}) {
  const method = (options.method ?? 'GET').toUpperCase()
  const startedAt = performance.now()
  const controller = new AbortController()
  const timeout = options.timeout ?? 15_000
  const timeoutId = window.setTimeout(() => controller.abort(), timeout)

  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw buildOfflineNetworkError({ path, method })
    }

    const authorizationHeader = await resolveAuthorizationHeader(options)
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
        ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
      },
      body: options.body != null ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })

    recordApiLatencyMetric(path, method, performance.now() - startedAt)
    return await parseResponse(response, path, method)
  } catch (error) {
    recordApiLatencyMetric(path, method, performance.now() - startedAt)
    if (error?.name === 'AbortError') {
      throw buildTimeoutError({ path, method, timeout })
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export async function requestBackend(path, options = {}) {
  const method = (options.method ?? 'GET').toUpperCase()
  const queueOffline = options.queueOffline ?? method !== 'GET'

  try {
    return await retryWithBackoff(() => dispatchBackendRequest(path, options), {
      retries: options.retries ?? (method === 'GET' ? 2 : 1),
      baseDelay: options.retryDelay ?? 700,
    })
  } catch (error) {
    const normalized = captureErrorForMonitoring(error, {
      feature: 'backend-api',
      action: 'request',
      path,
      method,
    })

    if (
      (normalized.code === 'OFFLINE_ERROR' || normalized.code === 'NETWORK_ERROR') &&
      queueOffline
    ) {
      enqueueOfflineRequest({
        path,
        method,
        body: options.body,
        headers: options.headers ?? {},
        skipAuth: options.skipAuth ?? false,
      })

      throw createOfflineQueuedError({
        path,
        method,
      })
    }

    throw normalized
  }
}

export function getPendingOfflineRequestsCount() {
  return getOfflineQueueCount()
}

export async function retryPendingOfflineRequests() {
  return flushOfflineRequestQueue(async (item) =>
    dispatchBackendRequest(item.path, {
      method: item.method,
      body: item.body,
      headers: item.headers,
      skipAuth: item.skipAuth,
      queueOffline: false,
      retries: 0,
    }),
  )
}
