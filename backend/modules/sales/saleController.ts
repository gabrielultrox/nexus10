import type { Express, Request, Response } from 'express'

import {
  createDirectSale,
  deleteSale,
  createSaleFromOrder,
  updateSaleStatus,
} from './saleService.js'
import { createLoggerContext, serializeError } from '../../logging/logger.js'
import { requirePermission } from '../../middleware/requireAuth.js'
import { validateRequest } from '../../middleware/validateRequest.js'
import { recordSaleCreatedMetric } from '../../monitoring/metrics.js'
import { publishNotificationEvent } from '../../services/eventBus.js'
import type {
  ApiErrorResponseBody,
  ApiSuccessResponseBody,
  AuthenticatedUserContext,
  ControllerErrorLike,
  OrderRouteParams,
  SaleRouteParams,
  StoreRouteParams,
} from '../../types/index.js'
import { createSaleSchema, updateSaleStatusSchema } from '../../validation/schemas.js'

type SaleRouteResponse = ApiSuccessResponseBody<unknown> | ApiErrorResponseBody
type SalePayloadBody = { tenantId?: string | null; values?: unknown; status?: string } | null | undefined

const salesLogger = createLoggerContext({ module: 'sales' })

function getRouteParams<TParams extends Record<string, string>>(request: Request): TParams {
  return request.params as TParams
}

function getPayload(body: SalePayloadBody): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    return {}
  }

  const values = 'values' in body ? body.values : undefined
  return values && typeof values === 'object'
    ? (values as Record<string, unknown>)
    : (body as Record<string, unknown>)
}

function getValidatedPayload(request: Request): unknown {
  return request.validated?.body ?? getPayload(request.body as SalePayloadBody)
}

function sendError(
  response: Response<SaleRouteResponse>,
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

function logSaleError(
  request: Request,
  action: string,
  error: unknown,
  extra: Record<string, unknown> = {},
): void {
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

function resolveSaleAmount(data: unknown): number {
  const record = data && typeof data === 'object' ? (data as Record<string, any>) : {}
  const summary = record.summary as Record<string, unknown> | undefined
  const totals = record.totals as Record<string, unknown> | undefined

  const candidates = [
    record.amount,
    record.total,
    record.totalAmount,
    record.netAmount,
    summary?.total,
    summary?.amount,
    totals?.total,
    totals?.grandTotal,
    totals?.finalAmount,
  ]

  const match = candidates.find((value) => Number.isFinite(Number(value)))
  return match == null ? 0 : Number(match)
}

function readRecordId(value: unknown): string | null {
  if (value && typeof value === 'object' && 'id' in value && value.id != null) {
    return String(value.id)
  }

  return null
}

export function registerSaleRoutes(app: Express): void {
  app.post(
    '/api/stores/:storeId/sales',
    requirePermission('sales:write'),
    validateRequest(createSaleSchema, {
      mapRequest: (request) => getPayload((request as Request).body as SalePayloadBody),
    }),
    async (request: Request, response: Response<SaleRouteResponse>) => {
      const { storeId } = getRouteParams<StoreRouteParams>(request)

      try {
        const body = request.body as SalePayloadBody
        const data = await createDirectSale({
          storeId,
          tenantId: body?.tenantId ?? null,
          values: getValidatedPayload(request),
          createdBy: getActorFromRequest(request),
        } as any)

        ;(request.log ?? salesLogger).info(
          {
            context: 'sales.create_direct',
            storeId,
            saleId: readRecordId(data),
            actorId: request.authUser?.uid ?? null,
          },
          'Direct sale created',
        )
        recordSaleCreatedMetric({
          storeId,
          amount: resolveSaleAmount(data),
        })
        await publishNotificationEvent({
          type: 'order.status.changed',
          title: 'Venda criada',
          message: `Venda ${readRecordId(data) ?? 'sem identificador'} registrada com sucesso.`,
          severity: 'success',
          storeId,
          tenantId: request.authUser?.tenantId ?? null,
          audience: {
            permissions: ['sales:read', 'sales:write'],
          },
          metadata: {
            route: '/sales',
            saleId: readRecordId(data),
          },
        })

        response.status(201).json({ data })
      } catch (error) {
        logSaleError(request, 'create_direct', error, {
          storeId,
          actorId: request.authUser?.uid ?? null,
        })
        sendError(response, (error as ControllerErrorLike) ?? {}, 'Nao foi possivel criar a venda.')
      }
    },
  )

  app.post(
    '/api/stores/:storeId/orders/:orderId/sales',
    requirePermission('sales:write'),
    validateRequest(createSaleSchema, {
      mapRequest: (request) => getPayload((request as Request).body as SalePayloadBody),
    }),
    async (request: Request, response: Response<SaleRouteResponse>) => {
      const { storeId, orderId } = getRouteParams<OrderRouteParams>(request)

      try {
        const body = request.body as SalePayloadBody
        const data = await createSaleFromOrder({
          storeId,
          tenantId: body?.tenantId ?? null,
          orderId,
          values: getValidatedPayload(request),
          createdBy: getActorFromRequest(request),
        } as any)

        ;(request.log ?? salesLogger).info(
          {
            context: 'sales.create_from_order',
            storeId,
            orderId,
            saleId: readRecordId(data),
            actorId: request.authUser?.uid ?? null,
          },
          'Sale created from order',
        )
        recordSaleCreatedMetric({
          storeId,
          amount: resolveSaleAmount(data),
        })
        await publishNotificationEvent({
          type: 'order.status.changed',
          title: 'Pedido convertido em venda',
          message: `Pedido ${orderId} gerou a venda ${readRecordId(data) ?? 'sem identificador'}.`,
          severity: 'success',
          storeId,
          tenantId: request.authUser?.tenantId ?? null,
          audience: {
            permissions: ['sales:read', 'sales:write'],
          },
          metadata: {
            route: '/sales',
            saleId: readRecordId(data),
            orderId,
          },
        })

        response.status(201).json({ data })
      } catch (error) {
        logSaleError(request, 'create_from_order', error, {
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

  app.patch(
    '/api/stores/:storeId/sales/:saleId/status',
    requirePermission('sales:write'),
    validateRequest(updateSaleStatusSchema),
    async (request: Request, response: Response<SaleRouteResponse>) => {
      const { storeId, saleId } = getRouteParams<SaleRouteParams>(request)

      try {
        const body = request.body as SalePayloadBody
        const status =
          (request.validated?.body as { status?: string } | undefined)?.status ?? body?.status ?? null

        const data = await updateSaleStatus({
          storeId,
          saleId,
          status,
          actor: getActorFromRequest(request),
        } as any)

        ;(request.log ?? salesLogger).info(
          {
            context: 'sales.update_status',
            storeId,
            saleId,
            status,
            actorId: request.authUser?.uid ?? null,
          },
          'Sale status updated',
        )

        response.json({ data })
      } catch (error) {
        logSaleError(request, 'update_status', error, {
          storeId,
          saleId,
          actorId: request.authUser?.uid ?? null,
        })
        sendError(
          response,
          (error as ControllerErrorLike) ?? {},
          'Nao foi possivel atualizar o status da venda.',
        )
      }
    },
  )

  app.delete(
    '/api/stores/:storeId/sales/:saleId',
    requirePermission('sales:write'),
    async (request: Request, response: Response<SaleRouteResponse>) => {
      const { storeId, saleId } = getRouteParams<SaleRouteParams>(request)

      try {
        const data = await deleteSale({
          storeId,
          saleId,
        } as any)

        ;(request.log ?? salesLogger).info(
          {
            context: 'sales.delete',
            storeId,
            saleId,
          },
          'Sale deleted',
        )

        response.json({ data })
      } catch (error) {
        logSaleError(request, 'delete', error, { storeId, saleId })
        sendError(
          response,
          (error as ControllerErrorLike) ?? {},
          'Nao foi possivel excluir a venda.',
        )
      }
    },
  )
}
