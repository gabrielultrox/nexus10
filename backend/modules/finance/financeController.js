import { randomUUID } from 'node:crypto'

import { createLoggerContext, serializeError } from '../../logging/logger.js'
import { validateRequest } from '../../middleware/validateRequest.js'
import {
  createFinancialClosureSchema,
  createFinancialTransactionSchema,
} from '../../validation/schemas.js'
import { createFinanceRepository } from './financeRepository.js'

const financeLogger = createLoggerContext({ module: 'finance' })
const financeRepository = createFinanceRepository()

function resolveStoreId(request) {
  return request.authUser?.defaultStoreId ?? request.authUser?.storeIds?.[0] ?? null
}

function sendFinanceError(request, response, error, fallbackMessage) {
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

export function registerFinanceRoutes(app) {
  app.post(
    '/api/finance/entries',
    validateRequest(createFinancialTransactionSchema),
    async (request, response) => {
      try {
        const storeId = resolveStoreId(request)

        if (!storeId) {
          response.status(400).json({
            error: 'Nao foi possivel determinar a loja da sessao atual.',
          })
          return
        }

        const payload = request.validated?.body ?? request.body
        const entryId = `manual-${randomUUID()}`
        const data = {
          id: entryId,
          ...payload,
          storeId,
          createdBy: request.authUser?.uid ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

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

        response.status(201).json({ data })
      } catch (error) {
        sendFinanceError(request, response, error, 'Nao foi possivel criar a entrada financeira.')
      }
    },
  )

  app.post(
    '/api/finance/closures',
    validateRequest(createFinancialClosureSchema),
    async (request, response) => {
      try {
        const storeId = resolveStoreId(request)

        if (!storeId) {
          response.status(400).json({
            error: 'Nao foi possivel determinar a loja da sessao atual.',
          })
          return
        }

        const payload = request.validated?.body ?? request.body
        const closureId = `closure-${randomUUID()}`
        const data = {
          id: closureId,
          ...payload,
          storeId,
          createdBy: request.authUser?.uid ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

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

        response.status(201).json({ data })
      } catch (error) {
        sendFinanceError(
          request,
          response,
          error,
          'Nao foi possivel criar o fechamento financeiro.',
        )
      }
    },
  )
}
