import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import swaggerUi from 'swagger-ui-express'

import { backendEnv, ensureBackendEnvLoaded } from './config/env.js'
import {
  createCorsProtectionMiddleware,
  createHttpsEnforcementMiddleware,
  createSecurityHeadersMiddleware,
  createUserAgentGuard,
  getTrustProxySetting,
} from './config/security.js'
import { RequestValidationError } from './errors/RequestValidationError.js'
import { logger, serializeError } from './logging/logger.js'
import { registerAuthRoutes } from './modules/auth/authController.js'
import { requireApiAuth, requireStoreAccess } from './middleware/requireAuth.js'
import {
  authenticatedApiRateLimiter,
  fileUploadRateLimiter,
  loginRateLimiter,
  publicRateLimiter,
} from './middleware/rateLimiter.js'
import { createAuditLoggerMiddleware } from './middleware/auditLogger.js'
import { requestLogger } from './middleware/requestLogger.js'
import { registerMonitoringRoutes } from './modules/admin/monitoringController.js'
import { registerAssistantRoutes } from './modules/assistant/assistantController.js'
import { registerAdminAuditLogRoutes } from './modules/admin/auditLogController.js'
import { registerFinanceRoutes } from './modules/finance/financeController.js'
import { registerOrderRoutes } from './modules/orders/orderController.js'
import { registerSaleRoutes } from './modules/sales/saleController.js'
import { buildPrometheusMetrics } from './metrics/prometheus.js'
import { getObservabilitySnapshot } from './monitoring/metrics.js'
import { registerEventRoutes } from './routes/events.js'
import { registerReportRoutes } from './routes/reports.js'
import { registerAnalyticsRoutes } from './routes/analytics.js'
import {
  buildMonitoredErrorPayload,
  captureError,
  initializeSentry,
  sentryRequestContextMiddleware,
  setupExpressSentry,
} from './monitoring/sentry.js'
import { getAdminApp } from './firebaseAdmin.js'
import { swaggerSpec, swaggerUiOptions } from './swagger.js'

interface HealthResponseBody {
  status: 'ok'
  service: string
  timestamp: string
}

interface ReadinessResponseBody {
  status: 'ok' | 'degraded'
  service: string
  timestamp: string
  release: string | null
  checks: {
    sentry: { status: 'ok' | 'disabled' }
    firestore: { status: 'ok' | 'degraded' }
    redis: { status: 'ok' | 'disabled' | 'degraded' }
    metrics: { status: 'ok' | 'degraded' }
    scheduler: { status: 'ok' | 'degraded'; staleWorkerCount: number; errorCount: number }
  }
}

export function createApp(): Express {
  ensureBackendEnvLoaded()

  const app = express()
  const appLogger = logger.child({ context: 'app' })

  initializeSentry()

  app.set('trust proxy', getTrustProxySetting())
  app.disable('x-powered-by')
  app.use(requestLogger)
  app.use(sentryRequestContextMiddleware)
  app.use(createUserAgentGuard())
  app.use(createSecurityHeadersMiddleware())
  app.use(createHttpsEnforcementMiddleware())
  app.use(createCorsProtectionMiddleware())

  app.use('/api', express.json())
  app.use('/api/auth/login', loginRateLimiter)
  app.use('/api/auth/session', loginRateLimiter)
  app.use('/api/uploads', fileUploadRateLimiter)

  app.get(
    '/api/health',
    publicRateLimiter,
    (_request: Request, response: Response<HealthResponseBody>) => {
      response.json({
        status: 'ok',
        service: 'nexus10-backend',
        timestamp: new Date().toISOString(),
      })
    },
  )

  app.get(
    '/api/health/ready',
    publicRateLimiter,
    async (_request: Request, response: Response<ReadinessResponseBody>) => {
      let firestoreReady = false

      try {
        getAdminApp()
        firestoreReady = true
      } catch {
        firestoreReady = false
      }

      const snapshot = await getObservabilitySnapshot()
      const checks = {
        sentry: {
          status: backendEnv.sentryDsn ? 'ok' : 'disabled',
        } as const,
        firestore: {
          status: snapshot.system.database.configured && firestoreReady ? 'ok' : 'degraded',
        } as const,
        redis: {
          status: !snapshot.system.cache.configured
            ? 'disabled'
            : snapshot.system.cache.status === 'connected'
              ? 'ok'
              : 'degraded',
        } as const,
        metrics: {
          status: snapshot.routes.length >= 0 ? 'ok' : 'degraded',
        } as const,
        scheduler: {
          status:
            snapshot.system.scheduler.status === 'degraded' ||
            snapshot.system.scheduler.staleWorkerCount > 0
              ? 'degraded'
              : 'ok',
          staleWorkerCount: snapshot.system.scheduler.staleWorkerCount ?? 0,
          errorCount: snapshot.system.scheduler.errorCount ?? 0,
        } as const,
      }

      const status = Object.values(checks).some((check) => check.status === 'degraded')
        ? 'degraded'
        : 'ok'

      response.status(status === 'ok' ? 200 : 503).json({
        status,
        service: 'nexus10-backend',
        timestamp: new Date().toISOString(),
        release: backendEnv.sentryRelease || null,
        checks,
      })
    },
  )

  app.get('/api/metrics', publicRateLimiter, async (_request: Request, response: Response) => {
    const metricsText = await buildPrometheusMetrics()
    response.type('text/plain; version=0.0.4; charset=utf-8').send(metricsText)
  })

  if (backendEnv.appEnv !== 'production') {
    app.get('/api/debug/sentry-test', publicRateLimiter, (request: Request, response: Response) => {
      const error = new Error('Nexus10 backend Sentry smoke test')

      captureError(
        error,
        buildMonitoredErrorPayload(error, {
          context: 'debug.sentry-test',
          request,
        }),
      )

      response.status(500).json({
        error: 'Evento de teste enviado para o Sentry.',
      })
    })
  }

  app.get('/api-docs.json', publicRateLimiter, (_request: Request, response: Response) => {
    response.json(swaggerSpec)
  })
  app.use(
    '/api-docs',
    publicRateLimiter,
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions),
  )

  registerAuthRoutes(app)
  registerEventRoutes(app)
  app.use('/api', requireApiAuth)
  app.use('/api', sentryRequestContextMiddleware)
  app.use('/api', authenticatedApiRateLimiter)
  app.use('/api', createAuditLoggerMiddleware())
  registerAdminAuditLogRoutes(app)
  registerMonitoringRoutes(app)
  registerReportRoutes(app)
  registerAnalyticsRoutes(app)
  registerFinanceRoutes(app)
  app.use('/api/stores/:storeId', requireStoreAccess, sentryRequestContextMiddleware)

  registerOrderRoutes(app)
  registerSaleRoutes(app)
  registerAssistantRoutes(app)

  setupExpressSentry(app)

  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    const requestLoggerInstance = request.log ?? appLogger

    if (error instanceof RequestValidationError) {
      requestLoggerInstance.warn(
        {
          context: 'express.validation',
          route: request.originalUrl,
          method: request.method,
          source: error.source,
          details: error.details,
        },
        error.message,
      )

      if (!response.headersSent) {
        response.status(error.statusCode).json({
          error: error.message,
          code: error.code,
          source: error.source,
          details: error.details,
        })
      }

      return
    }

    requestLoggerInstance.error(
      {
        context: 'express.unhandled',
        route: request.originalUrl,
        method: request.method,
        error: serializeError(error),
      },
      'Unhandled backend error',
    )

    captureError(
      error,
      buildMonitoredErrorPayload(error, {
        context: 'express.unhandled',
        route: request.originalUrl,
        method: request.method,
        request,
      }),
    )

    if (response.headersSent) {
      return
    }

    response.status(500).json({
      error: 'Erro interno no servidor.',
    })
  })

  return app
}

const app = createApp()

export default app
