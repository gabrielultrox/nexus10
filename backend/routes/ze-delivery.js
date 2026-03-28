import { createRateLimitMiddleware } from '../middleware/rateLimiter.js'
import { requireApiAuth, requirePermission } from '../middleware/requireAuth.js'
import { requireZeDeliverySyncAuth } from '../middleware/ze-delivery-auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  zeDeliveryIngestSchema,
  zeDeliveryManualSyncSchema,
  zeDeliveryRetryParamsSchema,
  zeDeliverySettingsQuerySchema,
  zeDeliverySettingsUpdateSchema,
  zeDeliveryStatusQuerySchema,
} from '../validation/schemas.js'
import { createZeDeliveryService } from '../integrations/ze-delivery/zeDeliveryService.js'
import { createLoggerContext, serializeError } from '../logging/logger.js'

const routeLogger = createLoggerContext({
  module: 'integrations.ze-delivery.routes',
})
let zeDeliveryService = null

function sendIntegrationError(request, response, error, fallbackMessage) {
  ;(request.log ?? routeLogger).error(
    {
      context: 'ze_delivery.route',
      error: serializeError(error),
      userId: request.authUser?.uid ?? null,
    },
    'Zé Delivery route failed',
  )

  response.status(error.statusCode ?? 500).json({
    error: error.message ?? fallbackMessage,
  })
}

function getZeDeliveryService() {
  if (!zeDeliveryService) {
    zeDeliveryService = createZeDeliveryService()
  }

  return zeDeliveryService
}

export function registerZeDeliveryRoutes(app) {
  const zeDeliveryIngestRateLimiter = createRateLimitMiddleware({
    name: 'ze-delivery-ingest',
    windowMs: 60 * 1000,
    max: 12,
    keyGenerator: (request) =>
      request.body?.storeId ?? request.header('x-forwarded-for') ?? request.ip ?? 'unknown',
  })

  const zeDeliveryManualSyncLimiter = createRateLimitMiddleware({
    name: 'ze-delivery-manual-sync',
    windowMs: 5 * 60 * 1000,
    max: 6,
    keyGenerator: (request) => request.authUser?.uid ?? request.ip ?? 'unknown',
  })

  app.post(
    '/api/integrations/ze-delivery/orders',
    zeDeliveryIngestRateLimiter,
    requireZeDeliverySyncAuth,
    validateRequest(zeDeliveryIngestSchema),
    async (request, response) => {
      try {
        const payload = request.validated?.body ?? request.body
        const result = await getZeDeliveryService().ingestScrapedOrders(payload)
        response.status(202).json({
          ok: true,
          data: result,
        })
      } catch (error) {
        sendIntegrationError(
          request,
          response,
          error,
          'Nao foi possivel ingerir as entregas do Zé Delivery.',
        )
      }
    },
  )

  app.get(
    '/api/integrations/ze-delivery/status',
    requireApiAuth,
    requirePermission('integrations:write'),
    validateRequest(zeDeliveryStatusQuerySchema, {
      source: 'query',
      mapRequest: (request) => request.query,
    }),
    async (request, response) => {
      try {
        const query = request.validated?.query ?? request.query
        const storeIds = query.storeId ? [query.storeId] : (request.authUser?.storeIds ?? [])

        const result = await getZeDeliveryService().getStatus({
          storeIds,
          storeId: query.storeId,
          limit: query.limit,
        })

        response.json({
          ok: true,
          data: result,
        })
      } catch (error) {
        sendIntegrationError(
          request,
          response,
          error,
          'Nao foi possivel consultar o status do Zé Delivery.',
        )
      }
    },
  )

  app.post(
    '/api/integrations/ze-delivery/sync',
    requireApiAuth,
    requirePermission('integrations:write'),
    zeDeliveryManualSyncLimiter,
    validateRequest(zeDeliveryManualSyncSchema),
    async (request, response) => {
      try {
        const payload = request.validated?.body ?? request.body
        const result = await getZeDeliveryService().runScrapeAndSync(payload)
        response.status(202).json({
          ok: true,
          data: result,
        })
      } catch (error) {
        sendIntegrationError(
          request,
          response,
          error,
          'Nao foi possivel executar a sincronizacao manual do Zé Delivery.',
        )
      }
    },
  )

  app.post(
    '/api/integrations/ze-delivery/orders/:storeId/:zeDeliveryId/retry',
    requireApiAuth,
    requirePermission('integrations:write'),
    validateRequest(zeDeliveryRetryParamsSchema, {
      source: 'params',
      mapRequest: (request) => request.params,
    }),
    async (request, response) => {
      try {
        const params = request.validated?.params ?? request.params
        const result = await getZeDeliveryService().retrySync({
          storeId: params.storeId,
          zeDeliveryId: params.zeDeliveryId,
        })

        response.status(202).json({
          ok: true,
          data: result,
        })
      } catch (error) {
        sendIntegrationError(
          request,
          response,
          error,
          'Nao foi possivel reprocessar a entrega do Zé Delivery.',
        )
      }
    },
  )

  app.get(
    '/api/integrations/ze-delivery/health',
    requireApiAuth,
    requirePermission('integrations:write'),
    async (request, response) => {
      try {
        const health = await getZeDeliveryService().getHealth()
        response.json({
          ok: true,
          data: health,
        })
      } catch (error) {
        sendIntegrationError(
          request,
          response,
          error,
          'Nao foi possivel consultar a saude do Ze Delivery.',
        )
      }
    },
  )

  app.get(
    '/api/integrations/ze-delivery/dashboard',
    requireApiAuth,
    requirePermission('integrations:write'),
    validateRequest(zeDeliveryStatusQuerySchema, {
      source: 'query',
      mapRequest: (request) => request.query,
    }),
    async (request, response) => {
      try {
        const query = request.validated?.query ?? request.query
        const storeIds = query.storeId
          ? [query.storeId]
          : request.authUser?.storeIds?.length
            ? request.authUser.storeIds
            : undefined
        const dashboard = await getZeDeliveryService().getDashboard({
          storeIds,
        })
        response.json({
          ok: true,
          data: dashboard,
        })
      } catch (error) {
        sendIntegrationError(
          request,
          response,
          error,
          'Nao foi possivel consultar o dashboard do Ze Delivery.',
        )
      }
    },
  )

  app.get(
    '/api/integrations/ze-delivery/settings',
    requireApiAuth,
    requirePermission('integrations:write'),
    validateRequest(zeDeliverySettingsQuerySchema, {
      source: 'query',
      mapRequest: (request) => request.query,
    }),
    async (request, response) => {
      try {
        const query = request.validated?.query ?? request.query
        const settings = await getZeDeliveryService().getStoreSettings({
          storeId: query.storeId,
        })

        response.json({
          ok: true,
          data: settings,
        })
      } catch (error) {
        sendIntegrationError(
          request,
          response,
          error,
          'Nao foi possivel consultar as configuracoes do Ze Delivery.',
        )
      }
    },
  )

  app.patch(
    '/api/integrations/ze-delivery/settings',
    requireApiAuth,
    requirePermission('integrations:write'),
    zeDeliveryManualSyncLimiter,
    validateRequest(zeDeliverySettingsUpdateSchema),
    async (request, response) => {
      try {
        const payload = request.validated?.body ?? request.body
        const settings = await getZeDeliveryService().updateStoreSettings({
          storeId: payload.storeId,
          settings: payload,
        })

        response.json({
          ok: true,
          data: settings,
        })
      } catch (error) {
        sendIntegrationError(
          request,
          response,
          error,
          'Nao foi possivel atualizar as configuracoes do Ze Delivery.',
        )
      }
    },
  )
}
