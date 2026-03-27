import {
  convertOrderToSale,
  createOrder,
  deleteOrder,
  markOrderAsDispatched,
  updateOrder,
} from './orderService.js'
import { createLoggerContext, serializeError } from '../../logging/logger.js'
import { requirePermission } from '../../middleware/requireAuth.js'
import { validateRequest } from '../../middleware/validateRequest.js'
import { recordOrderCreatedMetric } from '../../monitoring/metrics.js'
import { createOrderSchema, updateOrderSchema } from '../../validation/schemas.js'

const ordersLogger = createLoggerContext({ module: 'orders' })

function getPayload(body) {
  return body?.values ?? body ?? {}
}

function getValidatedPayload(request) {
  return request.validated?.body?.raw ?? getPayload(request.body)
}

function sendError(response, error, fallbackMessage) {
  response.status(error.statusCode ?? 500).json({
    error: error.message ?? fallbackMessage,
  })
}

function getActorFromRequest(request) {
  return request.authUser ?? null
}

function logOrderError(request, action, error, extra = {}) {
  const log = request.log ?? ordersLogger
  log.error(
    {
      context: `orders.${action}`,
      ...extra,
      error: serializeError(error),
    },
    'Order route failed',
  )
}

export function registerOrderRoutes(app) {
  app.post(
    '/api/stores/:storeId/orders',
    requirePermission('orders:write'),
    validateRequest(createOrderSchema, {
      mapRequest: (request) => getPayload(request.body),
    }),
    async (request, response) => {
      try {
        const data = await createOrder({
          storeId: request.params.storeId,
          tenantId: request.body?.tenantId ?? null,
          values: getValidatedPayload(request),
          createdBy: getActorFromRequest(request),
        })

        ;(request.log ?? ordersLogger).info(
          {
            context: 'orders.create',
            storeId: request.params.storeId,
            orderId: data.id ?? null,
            actorId: request.authUser?.uid ?? null,
          },
          'Order created',
        )
        recordOrderCreatedMetric({
          storeId: request.params.storeId,
        })

        response.status(201).json({ data })
      } catch (error) {
        logOrderError(request, 'create', error, {
          storeId: request.params.storeId,
          actorId: request.authUser?.uid ?? null,
        })
        sendError(response, error, 'Nao foi possivel criar o pedido.')
      }
    },
  )

  app.patch(
    '/api/stores/:storeId/orders/:orderId',
    requirePermission('orders:write'),
    validateRequest(updateOrderSchema, {
      mapRequest: (request) => getPayload(request.body),
    }),
    async (request, response) => {
      try {
        const data = await updateOrder({
          storeId: request.params.storeId,
          orderId: request.params.orderId,
          values: request.validated?.body ?? getPayload(request.body),
        })

        ;(request.log ?? ordersLogger).info(
          {
            context: 'orders.update',
            storeId: request.params.storeId,
            orderId: request.params.orderId,
          },
          'Order updated',
        )

        response.json({ data })
      } catch (error) {
        logOrderError(request, 'update', error, {
          storeId: request.params.storeId,
          orderId: request.params.orderId,
        })
        sendError(response, error, 'Nao foi possivel atualizar o pedido.')
      }
    },
  )

  app.post(
    '/api/stores/:storeId/orders/:orderId/dispatch',
    requirePermission('orders:write'),
    async (request, response) => {
      try {
        const data = await markOrderAsDispatched({
          storeId: request.params.storeId,
          orderId: request.params.orderId,
        })

        ;(request.log ?? ordersLogger).info(
          {
            context: 'orders.dispatch',
            storeId: request.params.storeId,
            orderId: request.params.orderId,
          },
          'Order dispatched',
        )

        response.json({ data })
      } catch (error) {
        logOrderError(request, 'dispatch', error, {
          storeId: request.params.storeId,
          orderId: request.params.orderId,
        })
        sendError(response, error, 'Nao foi possivel marcar o pedido como despachado.')
      }
    },
  )

  app.post(
    '/api/stores/:storeId/orders/:orderId/convert-to-sale',
    requirePermission('orders:write'),
    async (request, response) => {
      try {
        const data = await convertOrderToSale({
          storeId: request.params.storeId,
          tenantId: request.body?.tenantId ?? null,
          orderId: request.params.orderId,
          values: getPayload(request.body),
          createdBy: getActorFromRequest(request),
        })

        ;(request.log ?? ordersLogger).info(
          {
            context: 'orders.convert_to_sale',
            storeId: request.params.storeId,
            orderId: request.params.orderId,
            actorId: request.authUser?.uid ?? null,
          },
          'Order converted to sale',
        )

        response.json({ data })
      } catch (error) {
        logOrderError(request, 'convert_to_sale', error, {
          storeId: request.params.storeId,
          orderId: request.params.orderId,
          actorId: request.authUser?.uid ?? null,
        })
        sendError(response, error, 'Nao foi possivel gerar a venda a partir do pedido.')
      }
    },
  )

  app.delete(
    '/api/stores/:storeId/orders/:orderId',
    requirePermission('orders:write'),
    async (request, response) => {
      try {
        const data = await deleteOrder({
          storeId: request.params.storeId,
          orderId: request.params.orderId,
        })

        ;(request.log ?? ordersLogger).info(
          {
            context: 'orders.delete',
            storeId: request.params.storeId,
            orderId: request.params.orderId,
          },
          'Order deleted',
        )

        response.json({ data })
      } catch (error) {
        logOrderError(request, 'delete', error, {
          storeId: request.params.storeId,
          orderId: request.params.orderId,
        })
        sendError(response, error, 'Nao foi possivel excluir o pedido.')
      }
    },
  )
}
