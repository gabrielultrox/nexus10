import type { NextFunction, Request, Response } from 'express'

import { createFinanceRepository } from '../modules/finance/financeRepository.js'
import { createOrderRepository } from '../modules/orders/orderRepository.js'
import { createSaleRepository } from '../modules/sales/saleRepository.js'
import { queueAuditEvent } from '../services/auditService.js'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const orderRepository = createOrderRepository()
const saleRepository = createSaleRepository()
const financeRepository = createFinanceRepository()

interface AuditLocalsState {
  responseData?: unknown
  audit?: Partial<{
    action: 'create' | 'update' | 'delete' | 'approve' | 'reject'
    module: string
    entityType: string
    entityId: string
    description: string
    reason: string | null
    before: unknown
    after: unknown
    metadata: Record<string, unknown>
    notifyAdmin: boolean
  }>
  auditBeforePromise?: Promise<unknown>
}

function getLocals(response: Response): AuditLocalsState {
  return response.locals as AuditLocalsState
}

function normalizeMethod(request: Request): string {
  return String(request.method ?? '').toUpperCase()
}

function normalizePath(request: Request): string {
  return request.route?.path ?? request.path ?? request.originalUrl ?? ''
}

function getRequestBody(request: Request): Record<string, unknown> {
  const body = request.validated?.body ?? request.body
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
}

function resolveStoreId(request: Request): string {
  return (
    String(
      request.params?.storeId ??
        request.body?.storeId ??
        request.query?.storeId ??
        request.authUser?.defaultStoreId ??
        request.authUser?.storeIds?.[0] ??
        '',
    ).trim() || ''
  )
}

function summarizePayload(value: unknown): string {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const name = String(record.name ?? record.code ?? record.status ?? '').trim()
  return name ? ` (${name})` : ''
}

function inferAuditContext(request: Request, response: Response) {
  const path = request.originalUrl
  const method = normalizeMethod(request)
  const params = request.params ?? {}
  const body = getRequestBody(request)
  const responseData = getLocals(response).responseData

  if (path.includes('/orders') && !path.includes('/sales')) {
    if (path.endsWith('/dispatch')) {
      return {
        module: 'orders',
        entityType: 'order',
        entityId: String(params.orderId ?? ''),
        action: response.statusCode >= 400 ? 'reject' : 'approve',
        description: `Pedido ${params.orderId ?? ''} marcado como despachado.`,
      } as const
    }

    if (path.endsWith('/convert-to-sale')) {
      return {
        module: 'orders',
        entityType: 'order',
        entityId: String(params.orderId ?? ''),
        action: response.statusCode >= 400 ? 'reject' : 'approve',
        description: `Pedido ${params.orderId ?? ''} convertido em venda.`,
      } as const
    }

    return {
      module: 'orders',
      entityType: 'order',
      entityId: String(
        params.orderId ?? (responseData as Record<string, unknown> | undefined)?.id ?? '',
      ),
      action:
        response.statusCode >= 400
          ? 'reject'
          : method === 'POST'
            ? 'create'
            : method === 'DELETE'
              ? 'delete'
              : 'update',
      description:
        method === 'POST'
          ? `Pedido ${String((responseData as Record<string, unknown> | undefined)?.id ?? '').trim() || ''} criado${summarizePayload(responseData)}.`
          : method === 'DELETE'
            ? `Pedido ${params.orderId ?? ''} excluido.`
            : `Pedido ${params.orderId ?? ''} atualizado.`,
    } as const
  }

  if (path.includes('/sales')) {
    return {
      module: 'sales',
      entityType: 'sale',
      entityId: String(
        params.saleId ?? (responseData as Record<string, unknown> | undefined)?.id ?? '',
      ),
      action:
        response.statusCode >= 400
          ? 'reject'
          : method === 'POST'
            ? 'create'
            : method === 'DELETE'
              ? 'delete'
              : 'update',
      description:
        method === 'POST'
          ? `Venda ${String((responseData as Record<string, unknown> | undefined)?.id ?? '').trim() || ''} criada${summarizePayload(responseData)}.`
          : method === 'DELETE'
            ? `Venda ${params.saleId ?? ''} excluida.`
            : `Venda ${params.saleId ?? ''} atualizada.`,
      notifyAdmin: method === 'DELETE' && response.statusCode < 400,
    } as const
  }

  if (path.includes('/finance/entries')) {
    return {
      module: 'finance',
      entityType: 'financial_entry',
      entityId: String((responseData as Record<string, unknown> | undefined)?.id ?? ''),
      action: response.statusCode >= 400 ? 'reject' : 'create',
      description: `Lancamento financeiro ${String((responseData as Record<string, unknown> | undefined)?.id ?? '').trim() || ''} criado.`,
    } as const
  }

  if (path.includes('/finance/closures')) {
    return {
      module: 'cash',
      entityType: 'financial_closure',
      entityId: String((responseData as Record<string, unknown> | undefined)?.id ?? ''),
      action: response.statusCode >= 400 ? 'reject' : 'create',
      description: `Fechamento financeiro ${String((responseData as Record<string, unknown> | undefined)?.id ?? '').trim() || ''} registrado.`,
    } as const
  }

  if (path.includes('/integrations/')) {
    const entityId =
      String(
        params.merchantId ??
          params.orderId ??
          body.storeId ??
          body.merchantId ??
          body.zeDeliveryId ??
          '',
      ).trim() || 'integration-operation'

    return {
      module: 'integrations',
      entityType: 'integration',
      entityId,
      action: response.statusCode >= 400 ? 'reject' : method === 'DELETE' ? 'delete' : 'update',
      description: `Operacao de integracao executada em ${path}.`,
    } as const
  }

  return {
    module: 'system',
    entityType: 'request',
    entityId: request.id ?? 'request',
    action: response.statusCode >= 400 ? 'reject' : method === 'DELETE' ? 'delete' : 'update',
    description: `Operacao ${method} concluida em ${path}.`,
  } as const
}

async function captureBeforeSnapshot(request: Request): Promise<unknown> {
  const path = request.originalUrl
  const params = request.params ?? {}
  const storeId = resolveStoreId(request)

  if (!storeId) {
    return null
  }

  if (path.includes('/orders/') && params.orderId) {
    const order = await orderRepository.getOrderById({
      storeId,
      orderId: String(params.orderId),
    })
    return order?.data ?? null
  }

  if (path.includes('/sales/') && params.saleId) {
    const sale = await saleRepository.getSaleById({
      storeId,
      saleId: String(params.saleId),
    })
    return sale?.data ?? null
  }

  return null
}

export function createAuditLoggerMiddleware() {
  return function auditLogger(request: Request, response: Response, next: NextFunction): void {
    const method = normalizeMethod(request)

    if (!MUTATING_METHODS.has(method)) {
      next()
      return
    }

    const locals = getLocals(response)
    const originalJson = response.json.bind(response)
    locals.auditBeforePromise = captureBeforeSnapshot(request)

    response.json = ((body: unknown) => {
      const bodyRecord = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
      locals.responseData = bodyRecord.data ?? body
      return originalJson(body)
    }) as Response['json']

    response.on('finish', () => {
      const inferred = inferAuditContext(request, response)
      const extraAudit = locals.audit ?? {}
      const storeId = resolveStoreId(request)

      if (!storeId || response.statusCode < 200) {
        return
      }

      const body = getRequestBody(request)

      void Promise.resolve(locals.auditBeforePromise)
        .catch(() => null)
        .then((before) => {
          const responseData = locals.responseData
          const entityId = String(
            extraAudit.entityId ??
              inferred.entityId ??
              (responseData && typeof responseData === 'object'
                ? ((responseData as Record<string, unknown>).id ?? '')
                : ''),
          ).trim()

          if (!entityId) {
            return
          }

          queueAuditEvent({
            storeId,
            tenantId: request.authUser?.tenantId ?? null,
            userId: request.authUser?.uid ?? null,
            actor: {
              id: request.authUser?.uid ?? null,
              name:
                request.authUser?.operatorName ??
                request.authUser?.displayName ??
                request.authUser?.email ??
                'Sistema',
              role: request.authUser?.role ?? 'system',
            },
            action: extraAudit.action ?? inferred.action,
            module: extraAudit.module ?? inferred.module,
            entityType: extraAudit.entityType ?? inferred.entityType,
            entityId,
            description: extraAudit.description ?? inferred.description,
            reason:
              extraAudit.reason ??
              (typeof body.reason === 'string' ? body.reason : null) ??
              (typeof body.note === 'string' ? body.note : null),
            before: extraAudit.before ?? before,
            after: extraAudit.after ?? (response.statusCode >= 400 ? null : (responseData ?? body)),
            metadata: {
              ...(extraAudit.metadata ?? {}),
              requestBody: response.statusCode >= 400 ? body : undefined,
              originalPath: request.originalUrl,
            },
            ip: request.ip ?? null,
            method,
            path: request.originalUrl,
            requestId: request.id ?? null,
            statusCode: response.statusCode,
            notifyAdmin: extraAudit.notifyAdmin ?? inferred.notifyAdmin ?? false,
          })
        })
    })

    next()
  }
}
