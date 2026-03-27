import {
  createDirectSale,
  deleteSale,
  createSaleFromOrder,
  updateSaleStatus,
} from './saleService.js'
import { createLoggerContext, serializeError } from '../../logging/logger.js'
import { requirePermission } from '../../middleware/requireAuth.js'
import { validateRequest } from '../../middleware/validateRequest.js'
import { createSaleSchema, updateSaleStatusSchema } from '../../validation/schemas.js'

const salesLogger = createLoggerContext({ module: 'sales' })

function getPayload(body) {
  return body?.values ?? body ?? {}
}

function getValidatedPayload(request) {
  return request.validated?.body ?? getPayload(request.body)
}

function sendError(response, error, fallbackMessage) {
  response.status(error.statusCode ?? 500).json({
    error: error.message ?? fallbackMessage,
  })
}

function getActorFromRequest(request) {
  return request.authUser ?? null
}

function logSaleError(request, action, error, extra = {}) {
  const log = request.log ?? salesLogger
  log.error(
    {
      context: `sales.${action}`,
      ...extra,
      error: serializeError(error),
    },
    'Sale route failed',
  )
}

export function registerSaleRoutes(app) {
  app.post(
    '/api/stores/:storeId/sales',
    requirePermission('sales:write'),
    validateRequest(createSaleSchema, {
      mapRequest: (request) => getPayload(request.body),
    }),
    async (request, response) => {
      try {
        const data = await createDirectSale({
          storeId: request.params.storeId,
          tenantId: request.body?.tenantId ?? null,
          values: getValidatedPayload(request),
          createdBy: getActorFromRequest(request),
        })

        ;(request.log ?? salesLogger).info(
          {
            context: 'sales.create_direct',
            storeId: request.params.storeId,
            saleId: data.id ?? null,
            actorId: request.authUser?.uid ?? null,
          },
          'Direct sale created',
        )

        response.status(201).json({ data })
      } catch (error) {
        logSaleError(request, 'create_direct', error, {
          storeId: request.params.storeId,
          actorId: request.authUser?.uid ?? null,
        })
        sendError(response, error, 'Nao foi possivel criar a venda.')
      }
    },
  )

  app.post(
    '/api/stores/:storeId/orders/:orderId/sales',
    requirePermission('sales:write'),
    validateRequest(createSaleSchema, {
      mapRequest: (request) => getPayload(request.body),
    }),
    async (request, response) => {
      try {
        const data = await createSaleFromOrder({
          storeId: request.params.storeId,
          tenantId: request.body?.tenantId ?? null,
          orderId: request.params.orderId,
          values: getValidatedPayload(request),
          createdBy: getActorFromRequest(request),
        })

        ;(request.log ?? salesLogger).info(
          {
            context: 'sales.create_from_order',
            storeId: request.params.storeId,
            orderId: request.params.orderId,
            saleId: data.id ?? null,
            actorId: request.authUser?.uid ?? null,
          },
          'Sale created from order',
        )

        response.status(201).json({ data })
      } catch (error) {
        logSaleError(request, 'create_from_order', error, {
          storeId: request.params.storeId,
          orderId: request.params.orderId,
          actorId: request.authUser?.uid ?? null,
        })
        sendError(response, error, 'Nao foi possivel gerar a venda a partir do pedido.')
      }
    },
  )

  app.patch(
    '/api/stores/:storeId/sales/:saleId/status',
    requirePermission('sales:write'),
    validateRequest(updateSaleStatusSchema),
    async (request, response) => {
      try {
        const data = await updateSaleStatus({
          storeId: request.params.storeId,
          saleId: request.params.saleId,
          status: request.validated?.body?.status ?? request.body?.status,
          actor: getActorFromRequest(request),
        })

        ;(request.log ?? salesLogger).info(
          {
            context: 'sales.update_status',
            storeId: request.params.storeId,
            saleId: request.params.saleId,
            status: request.validated?.body?.status ?? request.body?.status ?? null,
            actorId: request.authUser?.uid ?? null,
          },
          'Sale status updated',
        )

        response.json({ data })
      } catch (error) {
        logSaleError(request, 'update_status', error, {
          storeId: request.params.storeId,
          saleId: request.params.saleId,
          actorId: request.authUser?.uid ?? null,
        })
        sendError(response, error, 'Nao foi possivel atualizar o status da venda.')
      }
    },
  )

  app.delete(
    '/api/stores/:storeId/sales/:saleId',
    requirePermission('sales:write'),
    async (request, response) => {
      try {
        const data = await deleteSale({
          storeId: request.params.storeId,
          saleId: request.params.saleId,
        })

        ;(request.log ?? salesLogger).info(
          {
            context: 'sales.delete',
            storeId: request.params.storeId,
            saleId: request.params.saleId,
          },
          'Sale deleted',
        )

        response.json({ data })
      } catch (error) {
        logSaleError(request, 'delete', error, {
          storeId: request.params.storeId,
          saleId: request.params.saleId,
        })
        sendError(response, error, 'Nao foi possivel excluir a venda.')
      }
    },
  )
}
