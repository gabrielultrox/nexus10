import { handleAssistantQuery } from './assistantService.js'
import { requirePermission } from '../../middleware/requireAuth.js'

function sendError(response, error, fallbackMessage) {
  response.status(error.statusCode ?? 500).json({
    error: error.message ?? fallbackMessage,
  })
}

export function registerAssistantRoutes(app) {
  app.post(
    '/api/stores/:storeId/assistant/query',
    requirePermission('assistant:write'),
    async (request, response) => {
      try {
        const data = await handleAssistantQuery({
          storeId: request.params.storeId,
          message: request.body?.message ?? '',
          context: request.body?.context ?? {},
        })

        response.json({ data })
      } catch (error) {
        sendError(response, error, 'Não foi possível processar a consulta da NEXA.')
      }
    },
  )
}
