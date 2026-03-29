import type { Express, Request, Response } from 'express'

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
import { publishNotificationEvent } from '../../services/eventBus.js'
import type {
  ApiErrorResponseBody,
  ApiSuccessResponseBody,
  AuthenticatedUserContext,
  ControllerErrorLike,
  OrderRouteParams,
  StoreRouteParams,
} from '../../types/index.js'
import { createOrderSchema, updateOrderSchema } from '../../validation/schemas.js'

type OrderRouteResponse = ApiSuccessResponseBody<unknown> | ApiErrorResponseBody
type OrderPayloadBody = { tenantId?: string | null; values?: unknown } | null | undefined

const ordersLogger = createLoggerContext({ module: 'orders' })

function getRouteParams<TParams extends Record<string, string>>(request: Request): TParams {
  return request.params as TParams
}

function getPayload(body: OrderPayloadBody): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    return {}
  }

  const values = 'values' in body ? body.values : undefined
  return values && typeof values === 'object'
    ? (values as Record<string, unknown>)
    : (body as Record<string, unknown>)
}

function getValidatedPayload(request: Request): unknown {
  const validatedBody = request.validated?.body as { raw?: unknown } | undefined
  return validatedBody?.raw ?? getPayload(request.body as OrderPayloadBody)
}

function sendError(
  response: Response<OrderRouteResponse>,
  error: ControllerErrorLike,
  fallbackMessage: string,
): void {
  response.status(error.statusCode ?? 500).json({
    error: error.message ?? fallbackMessage,
  })
}

function getActorFromRequest(request: Request): AuthenticatedUserContext | null {
  return request.authUser ?? null
}

function readRecordId(value: unknown): string | null {
  if (value && typeof value === 'object' && 'id' in value && value.id != null) {
    return String(value.id)
  }

  return null
}

function logOrderError(
  request: Request,
  action: string,
  error: unknown,
  extra: Record<string, unknown> = {},
): void {
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

export function registerOrderRoutes(app: Express): void {
  app.post(
    '/api/stores/:storeId/orders',
    requirePermission('orders:write'),
    validateRequest(createOrderSchema, {
      mapRequest: (request) => getPayload((request as Request).body as OrderPayloadBody),
    }),
    async (request: Request, response: Response<OrderRouteResponse>) => {
      const { storeId } = getRouteParams<StoreRouteParams>(request)

      try {
        const data = await createOrder({
          storeId,
          tenantId: ((request.body as OrderPayloadBody) ?? {})?.tenantId ?? null,
          values: getValidatedPayload(request),
          createdBy: getActorFromRequest(request),
        } as any)

        ;(request.log ?? ordersLogger).info(
          {
            context: 'orders.create',
            storeId,
            orderId: readRecordId(data),
            actorId: request.authUser?.uid ?? null,
          },
          'Order created',
        )
        recordOrderCreatedMetric({ storeId })
        await publishNotificationEvent({
          type: 'order.created',
          title: 'Novo pedido recebido',
          message: `Pedido ${readRecordId(data) ?? 'sem identificador'} entrou na fila operacional.`,
          severity: 'info',
          storeId,
          tenantId: request.authUser?.tenantId ?? null,
          audience: {
            permissions: ['orders:read', 'orders:write'],
          },
          metadata: {
            route: '/orders',
            orderId: readRecordId(data),
          },
        })

        response.status(201).json({ data })
      } catch (error) {
        logOrderError(request, 'create', error, {
          storeId,
          actorId: request.authUser?.uid ?? null,
        })
        sendError(
          response,
          (error as ControllerErrorLike) ?? {},
          'Nao foi possivel criar o pedido.',
        )
      }
    },
  )

  app.patch(
    '/api/stores/:storeId/orders/:orderId',
    requirePermission('orders:write'),
    validateRequest(updateOrderSchema, {
      mapRequest: (request) => getPayload((request as Request).body as OrderPayloadBody),
    }),
    async (request: Request, response: Response<OrderRouteResponse>) => {
      const { storeId, orderId } = getRouteParams<OrderRouteParams>(request)

      try {
        const data = await updateOrder({
          storeId,
          orderId,
          values: request.validated?.body ?? getPayload(request.body as OrderPayloadBody),
        } as any)

        ;(request.log ?? ordersLogger).info(
          {
            context: 'orders.update',
            storeId,
            orderId,
          },
          'Order updated',
        )
        await publishNotificationEvent({
          type: 'order.status.changed',
          title: 'Pedido atualizado',
          message: `Pedido ${orderId} teve o status ou dados principais alterados.`,
          severity: 'info',
          storeId,
          tenantId: request.authUser?.tenantId ?? null,
          audience: {
            permissions: ['orders:read', 'orders:write'],
          },
          metadata: {
            route: '/orders',
            orderId,
          },
        })

        response.json({ data })
      } catch (error) {
        logOrderError(request, 'update', error, { storeId, orderId })
        sendError(
          response,
          (error as ControllerErrorLike) ?? {},
          'Nao foi possivel atualizar o pedido.',
        )
      }
    },
  )

  app.post(
    '/api/stores/:storeId/orders/:orderId/dispatch',
    requirePermission('orders:write'),
    async (request: Request, response: Response<OrderRouteResponse>) => {
      const { storeId, orderId } = getRouteParams<OrderRouteParams>(request)

      try {
        const data = await markOrderAsDispatched({
          storeId,
          orderId,
        } as any)

        ;(request.log ?? ordersLogger).info(
          {
            context: 'orders.dispatch',
            storeId,
            orderId,
          },
          'Order dispatched',
        )
        await publishNotificationEvent({
          type: 'order.status.changed',
          title: 'Pedido despachado',
          message: `Pedido ${orderId} foi marcado como despachado.`,
          severity: 'success',
          storeId,
          tenantId: request.authUser?.tenantId ?? null,
          audience: {
            permissions: ['orders:read', 'orders:write'],
          },
          metadata: {
            route: '/orders',
            orderId,
            status: 'dispatched',
          },
        })

        response.json({ data })
      } catch (error) {
        logOrderError(request, 'dispatch', error, { storeId, orderId })
        sendError(
          response,
          (error as ControllerErrorLike) ?? {},
          'Nao foi possivel marcar o pedido como despachado.',
        )
      }
    },
  )

  app.post(
    '/api/stores/:storeId/orders/:orderId/convert-to-sale',
    requirePermission('orders:write'),
    async (request: Request, response: Response<OrderRouteResponse>) => {
      const { storeId, orderId } = getRouteParams<OrderRouteParams>(request)

      try {
        const body = request.body as OrderPayloadBody
        const data = await convertOrderToSale({
          storeId,
          tenantId: body?.tenantId ?? null,
          orderId,
          values: getPayload(body),
          createdBy: getActorFromRequest(request),
        } as any)

        ;(request.log ?? ordersLogger).info(
          {
            context: 'orders.convert_to_sale',
            storeId,
            orderId,
            actorId: request.authUser?.uid ?? null,
          },
          'Order converted to sale',
        )

        response.json({ data })
      } catch (error) {
        logOrderError(request, 'convert_to_sale', error, {
          storeId,
          orderId,
          actorId: request.authUser?.uid ?? null,
        })
        sendError(
          response,
          (error as ControllerErrorLike) ?? {},
          'Nao foi possivel gerar a venda a partir do pedido.',
        )
      }
    },
  )

  app.delete(
    '/api/stores/:storeId/orders/:orderId',
    requirePermission('orders:write'),
    async (request: Request, response: Response<OrderRouteResponse>) => {
      const { storeId, orderId } = getRouteParams<OrderRouteParams>(request)

      try {
        const data = await deleteOrder({
          storeId,
          orderId,
        } as any)

        ;(request.log ?? ordersLogger).info(
          {
            context: 'orders.delete',
            storeId,
            orderId,
          },
          'Order deleted',
        )

        response.json({ data })
      } catch (error) {
        logOrderError(request, 'delete', error, { storeId, orderId })
        sendError(
          response,
          (error as ControllerErrorLike) ?? {},
          'Nao foi possivel excluir o pedido.',
        )
      }
    },
  )
}
