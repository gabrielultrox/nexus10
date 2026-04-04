import type { Express, Request, Response } from 'express'

import { createLoggerContext, serializeError } from '../logging/logger.js'
import { requirePermission, requireScopedStoreAccess } from '../middleware/requireAuth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { analyticsQuerySchema } from '../schemas/validation.js'
import { buildAnalyticsSnapshot } from '../services/analyticsBuilder.js'
import type { ParsedQs } from 'qs'

const analyticsLogger = createLoggerContext({ module: 'analytics.routes' })

export function registerAnalyticsRoutes(app: Express): void {
  app.get(
    '/api/dashboard/analytics',
    requirePermission('reports:read'),
    validateRequest(analyticsQuerySchema, { source: 'query' }),
    requireScopedStoreAccess({ source: 'query', field: 'storeId' }),
    async (request: Request, response: Response) => {
      const query = (request.validated?.query ?? request.query) as ParsedQs & {
        storeId: string
        startDate: string
        endDate: string
        module?: 'all' | 'pdv'
        compareBy?: 'previous_period' | 'week' | 'month' | 'year'
      }

      try {
        const data = await buildAnalyticsSnapshot({
          storeId: String(query.storeId),
          startDate: String(query.startDate),
          endDate: String(query.endDate),
          module: query.module ?? 'all',
          compareBy: query.compareBy ?? 'previous_period',
        })

        response.json({ data })
      } catch (error) {
        ;(request.log ?? analyticsLogger).error(
          {
            context: 'dashboard.analytics',
            storeId: query.storeId,
            error: serializeError(error),
          },
          'Failed to load analytics dashboard',
        )

        response.status(500).json({
          error: 'Nao foi possivel carregar as metricas analiticas.',
        })
      }
    },
  )
}
