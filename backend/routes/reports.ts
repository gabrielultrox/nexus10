import type { Express, Request, Response } from 'express'

import { requirePermission, requireScopedStoreAccess } from '../middleware/requireAuth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { generateReportSchema, reportHistoryQuerySchema } from '../schemas/validation.js'
import { getReportDownload, listReportHistory, queueReportGeneration } from '../services/reportBuilder.js'
import { createLoggerContext, serializeError } from '../logging/logger.js'

const reportsLogger = createLoggerContext({ module: 'reports.routes' })

export function registerReportRoutes(app: Express): void {
  app.post(
    '/api/reports/generate',
    requirePermission('reports:read'),
    validateRequest(generateReportSchema),
    requireScopedStoreAccess({ source: 'body', field: 'storeId' }),
    async (request: Request, response: Response) => {
      const payload = request.validated?.body ?? request.body
      const actor = request.authUser

      if (!actor) {
        response.status(401).json({
          error: 'Sessao invalida para gerar relatorio.',
        })
        return
      }

      try {
        const report = await queueReportGeneration({
          storeId: String(payload.storeId),
          type: payload.type,
          format: payload.format,
          filters: {
            startDate: payload.startDate,
            endDate: payload.endDate,
            operator: payload.operator,
            module: payload.module,
            template: payload.template,
            scheduledFor: payload.scheduledFor,
          },
          actor,
        })

        response.status(202).json({
          data: report,
        })
      } catch (error) {
        ;(request.log ?? reportsLogger).error(
          {
            context: 'reports.generate',
            error: serializeError(error),
            storeId: payload.storeId,
          },
          'Failed to queue report generation',
        )
        response.status(500).json({
          error: 'Nao foi possivel gerar o relatorio.',
        })
      }
    },
  )

  app.get(
    '/api/reports/history',
    requirePermission('reports:read'),
    validateRequest(reportHistoryQuerySchema, { source: 'query' }),
    requireScopedStoreAccess({ source: 'query', field: 'storeId' }),
    async (request: Request, response: Response) => {
      const query = request.validated?.query ?? request.query

      try {
        const items = await listReportHistory(String(query.storeId), Number(query.limit ?? 20))
        response.json({
          data: items,
        })
      } catch (error) {
        ;(request.log ?? reportsLogger).error(
          {
            context: 'reports.history',
            error: serializeError(error),
            storeId: query.storeId,
          },
          'Failed to list report history',
        )
        response.status(500).json({
          error: 'Nao foi possivel carregar o historico de relatorios.',
        })
      }
    },
  )

  app.get(
    '/api/reports/:reportId/download',
    requirePermission('reports:read'),
    requireScopedStoreAccess({ source: 'query', field: 'storeId' }),
    async (request: Request, response: Response) => {
      const reportId = String(request.params.reportId)
      const storeId = String(request.query.storeId ?? '')

      try {
        const report = await getReportDownload(storeId, reportId)

        if (!report) {
          response.status(404).json({
            error: 'Relatorio nao encontrado.',
          })
          return
        }

        if (!report.buffer) {
          response.status(409).json({
            error: 'Relatorio ainda nao esta pronto para download.',
            status: report.status,
          })
          return
        }

        response.setHeader('content-type', report.contentType)
        response.setHeader('content-disposition', `attachment; filename="${report.fileName}"`)
        response.send(report.buffer)
      } catch (error) {
        ;(request.log ?? reportsLogger).error(
          {
            context: 'reports.download',
            error: serializeError(error),
            storeId,
            reportId,
          },
          'Failed to download report',
        )
        response.status(500).json({
          error: 'Nao foi possivel baixar o relatorio.',
        })
      }
    },
  )
}
