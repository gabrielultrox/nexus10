import { randomUUID } from 'node:crypto'

import type { Express, Request, Response } from 'express'

import { createLoggerContext, serializeError } from '../../logging/logger.js'
import { requirePermission } from '../../middleware/requireAuth.js'
import { validateRequest } from '../../middleware/validateRequest.js'
import type {
  ApiErrorResponseBody,
  ApiSuccessResponseBody,
  ControllerErrorLike,
} from '../../types/index.js'
import {
  createFinancialClosureSchema,
  createFinancialTransactionSchema,
} from '../../validation/schemas.js'
import { createFinanceRepository } from './financeRepository.js'
import { publishNotificationEvent } from '../../services/eventBus.js'

type FinanceRouteResponse = ApiSuccessResponseBody<Record<string, unknown>> | ApiErrorResponseBody

const financeLogger = createLoggerContext({ module: 'finance' })
const financeRepository = createFinanceRepository()

function resolveStoreId(request: Request): string | null {
  return request.authUser?.defaultStoreId ?? request.authUser?.storeIds?.[0] ?? null
}

function sendFinanceError(
  request: Request,
  response: Response<FinanceRouteResponse>,
  error: ControllerErrorLike,
  fallbackMessage: string,
): void {
  ;(request.log ?? financeLogger).error(
    {
      context: 'finance.route',
      error: serializeError(error),
      userId: request.authUser?.uid ?? null,
    },
    'Finance route failed',
  )

  response.status(error.statusCode ?? 500).json({
    error: error.message ?? fallbackMessage,
  })
}

function buildFinancePayload(
  request: Request,
  id: string,
  storeId: string,
): Record<string, unknown> {
  const payload =
    request.validated?.body && typeof request.validated.body === 'object'
      ? (request.validated.body as Record<string, unknown>)
      : ((request.body as Record<string, unknown> | undefined) ?? {})
  const timestamp = new Date().toISOString()

  return {
    id,
    ...payload,
    storeId,
    createdBy: request.authUser?.uid ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function resolveAmount(data: Record<string, unknown>): number {
  const amount = Number(data.amount ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

export function registerFinanceRoutes(app: Express): void {
  app.post(
    '/api/finance/entries',
    requirePermission('finance:write'),
    validateRequest(createFinancialTransactionSchema),
    async (request: Request, response: Response<FinanceRouteResponse>) => {
      try {
        const storeId = resolveStoreId(request)

        if (!storeId) {
          response.status(400).json({
            error: 'Nao foi possivel determinar a loja da sessao atual.',
          })
          return
        }

        const entryId = `manual-${randomUUID()}`
        const data = buildFinancePayload(request, entryId, storeId)

        await financeRepository.upsertFinancialEntry(storeId, entryId, data)
        ;(request.log ?? financeLogger).info(
          {
            context: 'finance.entries.create',
            storeId,
            entryId,
            actorId: request.authUser?.uid ?? null,
          },
          'Finance entry created',
        )
        const amount = resolveAmount(data)
        if (Math.abs(amount) >= 300 || String(data.type ?? '').toLowerCase() === 'expense') {
          await publishNotificationEvent({
            type: 'cash.critical',
            title: 'Alerta financeiro',
            message: `Lancamento financeiro de R$ ${amount.toFixed(2)} requer atencao operacional.`,
            severity: amount < 0 ? 'error' : 'warning',
            storeId,
            tenantId: request.authUser?.tenantId ?? null,
            audience: {
              permissions: ['finance:read', 'finance:write'],
            },
            metadata: {
              route: '/finance',
              entryId,
              amount,
              type: data.type ?? null,
            },
          })
        }

        response.status(201).json({ data })
      } catch (error) {
        sendFinanceError(
          request,
          response,
          (error as ControllerErrorLike) ?? {},
          'Nao foi possivel criar a entrada financeira.',
        )
      }
    },
  )

  app.post(
    '/api/finance/closures',
    requirePermission('finance:write'),
    validateRequest(createFinancialClosureSchema),
    async (request: Request, response: Response<FinanceRouteResponse>) => {
      try {
        const storeId = resolveStoreId(request)

        if (!storeId) {
          response.status(400).json({
            error: 'Nao foi possivel determinar a loja da sessao atual.',
          })
          return
        }

        const closureId = `closure-${randomUUID()}`
        const data = buildFinancePayload(request, closureId, storeId)

        await financeRepository.upsertFinancialClosure(storeId, closureId, data)
        ;(request.log ?? financeLogger).info(
          {
            context: 'finance.closures.create',
            storeId,
            closureId,
            actorId: request.authUser?.uid ?? null,
          },
          'Finance closure created',
        )
        const balance = Number(data.balance ?? 0)
        if (Number.isFinite(balance) && balance <= 200) {
          await publishNotificationEvent({
            type: 'cash.critical',
            title: 'Caixa critico',
            message: `Fechamento indica saldo de R$ ${balance.toFixed(2)}. Revisao imediata recomendada.`,
            severity: balance < 0 ? 'error' : 'warning',
            storeId,
            tenantId: request.authUser?.tenantId ?? null,
            audience: {
              permissions: ['finance:read', 'finance:write'],
            },
            metadata: {
              route: '/cash',
              closureId,
              balance,
            },
          })
        }

        response.status(201).json({ data })
      } catch (error) {
        sendFinanceError(
          request,
          response,
          (error as ControllerErrorLike) ?? {},
          'Nao foi possivel criar o fechamento financeiro.',
        )
      }
    },
  )
}
