import { randomUUID } from 'node:crypto'

import { createLoggerContext, serializeError } from '../logging/logger.js'
import { evaluateMonitoringAlerts } from '../monitoring/alerts.js'
import { recordRequestMetric, getMonitoringSnapshot } from '../monitoring/metrics.js'

function resolveRoute(request) {
  return request.route?.path ?? request.baseUrl ?? request.path ?? request.originalUrl ?? 'unknown'
}

export function requestLogger(request, response, next) {
  const startedAt = process.hrtime.bigint()
  const requestId = request.headers['x-request-id'] || randomUUID()

  request.id = requestId
  request.log = createLoggerContext({
    requestId,
    method: request.method,
    route: request.originalUrl,
  })

  response.setHeader('x-request-id', requestId)

  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
    const level =
      response.statusCode >= 500 ? 'error' : response.statusCode >= 400 ? 'warn' : 'info'
    const isIfoodWebhook = request.originalUrl.startsWith('/webhooks/ifood/')

    request.log[level](
      {
        context: 'http.request',
        method: request.method,
        route: resolveRoute(request),
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? 'unknown',
      },
      'HTTP request completed',
    )

    recordRequestMetric({
      method: request.method,
      route: resolveRoute(request),
      path: request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      isIfoodWebhook,
      storeId: request.params?.storeId,
      merchantId: request.params?.merchantId,
    })

    void evaluateMonitoringAlerts(getMonitoringSnapshot()).catch((error) => {
      request.log.warn(
        {
          context: 'monitoring.alerts.evaluate',
          error: serializeError(error),
        },
        'Failed to evaluate monitoring alerts',
      )
    })
  })

  response.on('error', (error) => {
    request.log.error(
      {
        context: 'http.response',
        route: resolveRoute(request),
        error: serializeError(error),
      },
      'HTTP response stream failed',
    )
  })

  next()
}
