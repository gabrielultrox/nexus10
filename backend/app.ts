import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import swaggerUi from 'swagger-ui-express'

import { backendEnv, ensureBackendEnvLoaded } from './config/env.js'
import {
  buildContentSecurityPolicyDirectives,
  createCorsProtectionMiddleware,
  createHttpsEnforcementMiddleware,
  createSecurityHeadersMiddleware,
  createUserAgentGuard,
  getTrustProxySetting,
  isAllowedOrigin,
} from './config/security.js'
import { RequestValidationError } from './errors/RequestValidationError.js'
import { logger, serializeError } from './logging/logger.js'
import { registerAuthRoutes } from './modules/auth/authController.js'
import { createIfoodFirestoreRepository } from './integrations/ifood/ifoodFirestoreRepository.js'
import { createIfoodIntegrationRuntime } from './integrations/ifood/ifoodIntegrationRuntime.js'
import {
  requireApiAuth,
  requirePermission,
  requireScopedStoreAccess,
  requireStoreAccess,
} from './middleware/requireAuth.js'
import {
  authenticatedApiRateLimiter,
  fileUploadRateLimiter,
  ifoodWebhookRateLimiter,
  loginRateLimiter,
  publicRateLimiter,
} from './middleware/rateLimiter.js'
import { createAuditLoggerMiddleware } from './middleware/auditLogger.js'
import { requestLogger } from './middleware/requestLogger.js'
import { validateRequest } from './middleware/validateRequest.js'
import { registerMonitoringRoutes } from './modules/admin/monitoringController.js'
import { registerAssistantRoutes } from './modules/assistant/assistantController.js'
import { registerAdminAuditLogRoutes } from './modules/admin/auditLogController.js'
import { registerFinanceRoutes } from './modules/finance/financeController.js'
import { registerOrderRoutes } from './modules/orders/orderController.js'
import { registerSaleRoutes } from './modules/sales/saleController.js'
import { buildPrometheusMetrics } from './metrics/prometheus.js'
import { getObservabilitySnapshot } from './monitoring/metrics.js'
import { registerZeDeliveryRoutes } from './routes/ze-delivery.js'
import { registerEventRoutes } from './routes/events.js'
import { registerReportRoutes } from './routes/reports.js'
import {
  buildMonitoredErrorPayload,
  captureError,
  initializeSentry,
  sentryRequestContextMiddleware,
  setupExpressSentry,
} from './monitoring/sentry.js'
import { getAdminApp } from './firebaseAdmin.js'
import { swaggerSpec, swaggerUiOptions } from './swagger.js'
import {
  getIntegrationMerchant,
  listIntegrationMerchants,
  touchIntegrationMerchant,
} from './repositories/integrationMerchantRepository.js'
import {
  ifoodOrderSyncParamsSchema,
  ifoodPollingSchema,
  ifoodWebhookSchema,
} from './validation/schemas.js'

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

interface IfoodAccessToken {
  accessToken?: string
  access_token?: string
}

function sanitizeIfoodMerchantForResponse(merchant: unknown) {
  const record = (merchant ?? {}) as Record<string, unknown>

  return {
    id: record.id ?? null,
    merchantId: record.merchantId ?? record.id ?? null,
    source: record.source ?? 'ifood',
    name: record.name ?? null,
    tenantId: record.tenantId ?? null,
    status: record.status ?? null,
    lastPollingAt: record.lastPollingAt ?? null,
    lastSyncAt: record.lastSyncAt ?? null,
    lastSyncError: record.lastSyncError ?? null,
    lastWebhookAt: record.lastWebhookAt ?? null,
    updatedAt: record.updatedAt ?? null,
    createdAt: record.createdAt ?? null,
  }
}

export function createApp(): Express {
  ensureBackendEnvLoaded()

  const app = express()
  const repository = createIfoodFirestoreRepository()
  const appLogger = logger.child({ context: 'app' })
  const runtime = createIfoodIntegrationRuntime({
    env: backendEnv,
    repositories: repository,
  })

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
  app.use('/webhooks/ifood', express.text({ type: '*/*' }), ifoodWebhookRateLimiter)
  app.use('/api/uploads', fileUploadRateLimiter)

  app.get(
    '/api/health',
    publicRateLimiter,
    (_request: Request, response: Response<HealthResponseBody>) => {
      response.json({
        status: 'ok',
        service: 'nexus-ifood-integration',
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
        service: 'nexus-ifood-integration',
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
  registerZeDeliveryRoutes(app)
  app.use('/api', requireApiAuth)
  app.use('/api', sentryRequestContextMiddleware)
  app.use('/api', authenticatedApiRateLimiter)
  app.use('/api', createAuditLoggerMiddleware())
  registerAdminAuditLogRoutes(app)
  registerMonitoringRoutes(app)
  registerReportRoutes(app)
  registerFinanceRoutes(app)
  app.use('/api/stores/:storeId', requireStoreAccess, sentryRequestContextMiddleware)

  registerOrderRoutes(app)
  registerSaleRoutes(app)
  registerAssistantRoutes(app)

  app.get(
    '/api/integrations/ifood/merchants/:storeId',
    requirePermission('integrations:write'),
    requireScopedStoreAccess({ source: 'params', field: 'storeId' }),
    async (request, response) => {
      try {
        const merchants = await listIntegrationMerchants({
          storeId: String(request.params.storeId),
          source: 'ifood',
        })

        response.json({
          data: merchants.map(sanitizeIfoodMerchantForResponse),
        })
      } catch (error) {
        request.log?.error(
          {
            context: 'ifood.merchants.list',
            storeId: String(request.params.storeId),
            error: serializeError(error),
          },
          'Failed to list iFood merchants',
        )
        response.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : 'Nao foi possivel listar os merchants do iFood.',
        })
      }
    },
  )

  app.post(
    '/api/integrations/ifood/polling/run',
    validateRequest(ifoodPollingSchema),
    requirePermission('integrations:write'),
    requireScopedStoreAccess({ source: 'body', field: 'storeId' }),
    async (request, response) => {
      const { storeId, merchantId } = (request.validated?.body ?? request.body ?? {}) as {
        storeId: string
        merchantId: string
      }

      try {
        const merchant = await getIntegrationMerchant({
          storeId,
          merchantId,
          source: 'ifood',
        })

        if (!merchant) {
          response.status(404).json({
            error: 'Merchant iFood nao encontrado para a loja informada.',
          })
          return
        }

        const authToken = (await (runtime.adapter as any).getAccessToken({
          clientId: merchant.clientId,
          clientSecret: merchant.clientSecret,
        })) as IfoodAccessToken

        const pollingResult = await runtime.eventService.processPolling({
          storeId,
          tenantId: merchant.tenantId ?? null,
          merchant,
          accessToken: authToken.accessToken ?? authToken.access_token,
        })

        await touchIntegrationMerchant({
          storeId,
          merchantId,
          updates: {
            lastPollingAt: new Date().toISOString(),
            lastSyncAt: new Date().toISOString(),
            lastSyncError: null,
          },
        })

        response.json({
          ok: true,
          data: pollingResult,
        })
      } catch (error) {
        captureError(
          error,
          buildMonitoredErrorPayload(error, {
            context: 'ifood.polling.run',
            storeId,
            merchantId,
            request,
          }),
        )
        request.log?.error(
          {
            context: 'ifood.polling.run',
            storeId,
            merchantId,
            error: serializeError(error),
          },
          'Failed to run iFood polling',
        )
        await touchIntegrationMerchant({
          storeId,
          merchantId,
          updates: {
            lastSyncError: error instanceof Error ? error.message : 'Falha no polling do iFood.',
          },
        }).catch(() => {})

        response.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : 'Nao foi possivel executar o polling do iFood.',
        })
      }
    },
  )

  app.post(
    '/api/integrations/ifood/orders/:storeId/:merchantId/:orderId/sync',
    validateRequest(ifoodOrderSyncParamsSchema, {
      source: 'params',
      mapRequest: (request) => (request as Request).params,
    }),
    requirePermission('integrations:write'),
    requireScopedStoreAccess({ source: 'params', field: 'storeId' }),
    async (request, response) => {
      const { storeId, merchantId, orderId } = (request.validated?.params ?? request.params) as {
        storeId: string
        merchantId: string
        orderId: string
      }

      try {
        const merchant = await getIntegrationMerchant({
          storeId,
          merchantId,
          source: 'ifood',
        })

        if (!merchant) {
          response.status(404).json({
            error: 'Merchant iFood nao encontrado para a loja informada.',
          })
          return
        }

        const authToken = (await (runtime.adapter as any).getAccessToken({
          clientId: merchant.clientId,
          clientSecret: merchant.clientSecret,
        })) as IfoodAccessToken
        const rawOrder = await (runtime.adapter as any).getOrderDetails({
          accessToken: authToken.accessToken ?? authToken.access_token,
          orderId,
        })
        const normalizedOrder = await runtime.orderService.upsertOrderFromDetails({
          storeId,
          tenantId: merchant.tenantId ?? null,
          merchant,
          rawOrder,
          syncContext: {
            syncedAt: new Date().toISOString(),
          },
        })

        response.json({
          ok: true,
          data: normalizedOrder,
        })
      } catch (error) {
        captureError(
          error,
          buildMonitoredErrorPayload(error, {
            context: 'ifood.order.sync',
            storeId,
            merchantId,
            orderId,
            request,
          }),
        )
        request.log?.error(
          {
            context: 'ifood.order.sync',
            storeId,
            merchantId,
            orderId,
            error: serializeError(error),
          },
          'Failed to sync iFood order',
        )
        response.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : 'Nao foi possivel sincronizar o pedido do iFood.',
        })
      }
    },
  )

  app.post(
    '/webhooks/ifood/:storeId/:merchantId',
    sentryRequestContextMiddleware,
    validateRequest(ifoodWebhookSchema, {
      source: 'webhook',
      mapRequest: (request) => ({
        signature: (request as Request).header('X-IFood-Signature'),
        body: String((request as Request).body ?? ''),
      }),
    }),
    async (request, response) => {
      const storeId = String(request.params.storeId)
      const merchantId = String(request.params.merchantId)
      const validatedWebhook = (((request.validated as Record<string, unknown> | undefined) ?? {})[
        'webhook'
      ] ?? {}) as {
        signature: string
        body: string
      }
      const signature = validatedWebhook.signature
      const rawBody = validatedWebhook.body

      try {
        const merchant = await getIntegrationMerchant({
          storeId,
          merchantId,
          source: 'ifood',
        })

        if (!merchant) {
          response.status(404).json({
            error: 'Merchant iFood nao encontrado para esta loja.',
          })
          return
        }

        const authToken = (await (runtime.adapter as any).getAccessToken({
          clientId: merchant.clientId,
          clientSecret: merchant.clientSecret,
        })) as IfoodAccessToken

        const result = await runtime.eventService.processWebhook({
          storeId,
          tenantId: merchant.tenantId ?? null,
          merchant,
          accessToken: authToken.accessToken ?? authToken.access_token,
          rawBody,
          signature,
        })

        await touchIntegrationMerchant({
          storeId,
          merchantId,
          updates: {
            lastWebhookAt: new Date().toISOString(),
            lastSyncAt: new Date().toISOString(),
            lastSyncError: null,
          },
        })

        response.json({
          ok: true,
          data: result,
        })
      } catch (error) {
        captureError(
          error,
          buildMonitoredErrorPayload(error, {
            context: 'ifood.webhook',
            storeId,
            merchantId,
            request,
          }),
        )
        request.log?.error(
          {
            context: 'ifood.webhook',
            storeId,
            merchantId,
            error: serializeError(error),
          },
          'Failed to process iFood webhook',
        )
        await touchIntegrationMerchant({
          storeId,
          merchantId,
          updates: {
            lastSyncError: error instanceof Error ? error.message : 'Falha no webhook do iFood.',
          },
        }).catch(() => {})

        response.status(401).json({
          error:
            error instanceof Error
              ? error.message
              : 'Nao foi possivel processar o webhook do iFood.',
        })
      }
    },
  )

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
