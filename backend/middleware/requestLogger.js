import { randomUUID } from 'node:crypto'

import { createRequestLoggerContext, serializeError } from '../logging/logger.js'
import { evaluateMonitoringAlerts } from '../monitoring/alerts.js'
import { getMonitoringSnapshot, recordRequestMetric } from '../monitoring/metrics.js'

function resolveRoute(request) {
  return request.route?.path ?? request.baseUrl ?? request.path ?? request.originalUrl ?? 'unknown'
}

function resolveClientIp(request) {
  const forwardedFor = request.headers['x-forwarded-for']

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim()
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return String(forwardedFor[0]).trim()
  }

  return request.ip ?? request.socket?.remoteAddress ?? 'unknown'
}

export function requestLogger(request, response, next) {
  const startedAt = process.hrtime.bigint()
  const requestId = String(request.headers['x-request-id'] ?? randomUUID())
  const ipAddress = resolveClientIp(request)

  request.id = requestId
  request.log = createRequestLoggerContext({
    requestId,
    method: request.method,
    route: request.originalUrl,
    ipAddress,
  })

  response.setHeader('x-request-id', requestId)

  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
    const resolvedRoute = resolveRoute(request)
    const userId = request.authUser?.uid ?? null
    const logLevel =
      response.statusCode >= 500 ? 'error' : response.statusCode >= 400 ? 'warn' : 'info'
    const requestLog = request.log?.child
      ? request.log.child({ user_id: userId, route: resolvedRoute, ip_address: ipAddress })
      : request.log

    requestLog?.[logLevel]?.(
      {
        context: 'http.request',
        request_id: requestId,
        method: request.method,
        route: resolvedRoute,
        path: request.originalUrl,
        status_code: response.statusCode,
        duration_ms: Number(durationMs.toFixed(2)),
        ip_address: ipAddress,
        user_id: userId,
      },
      'HTTP request completed',
    )

    recordRequestMetric({
      method: request.method,
      route: resolvedRoute,
      path: request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      storeId: request.params?.storeId,
      merchantId: request.params?.merchantId,
    })

    void evaluateMonitoringAlerts(getMonitoringSnapshot()).catch((error) => {
      requestLog?.warn?.(
        {
          context: 'monitoring.alerts.evaluate',
          request_id: requestId,
          error: serializeError(error),
        },
        'Failed to evaluate monitoring alerts',
      )
    })
  })

  response.on('error', (error) => {
    request.log?.error?.(
      {
        context: 'http.response',
        request_id: requestId,
        route: resolveRoute(request),
        ip_address: ipAddress,
        user_id: request.authUser?.uid ?? null,
        error: serializeError(error),
      },
      'HTTP response stream failed',
    )
  })

  next()
}
