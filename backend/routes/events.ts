import type { Express, Request, Response } from 'express'

import { cacheRemember } from '../cache/cacheService.js'
import { backendEnv } from '../config/env.js'
import { getAdminApp } from '../firebaseAdmin.js'
import { createLoggerContext, serializeError } from '../logging/logger.js'
import { publicRateLimiter } from '../middleware/rateLimiter.js'
import { registerEventClient, publishNotificationEvent } from '../services/eventBus.js'

const eventsLogger = createLoggerContext({ module: 'events-route' })

const rolePermissions: Record<string, string[]> = {
  admin: [
    'audit:read',
    'assistant:write',
    'finance:read',
    'finance:write',
    'orders:read',
    'orders:write',
    'sales:read',
    'sales:write',
    'integrations:write',
    'settings:write',
  ],
  gerente: [
    'assistant:write',
    'finance:read',
    'finance:write',
    'orders:read',
    'orders:write',
    'sales:read',
    'sales:write',
    'integrations:write',
  ],
  operador: ['assistant:write', 'orders:read', 'orders:write', 'sales:read', 'finance:read'],
  atendente: ['orders:read', 'orders:write'],
}

function normalizeRole(role: unknown): string {
  switch (String(role ?? '').trim().toLowerCase()) {
    case 'admin':
      return 'admin'
    case 'gerente':
    case 'manager':
      return 'gerente'
    case 'atendente':
    case 'attendant':
      return 'atendente'
    default:
      return 'operador'
  }
}

async function authenticateEventRequest(request: Request) {
  const token = String(request.query.access_token ?? '').trim()

  if (!token) {
    throw new Error('Token de autenticacao ausente na stream SSE.')
  }

  const decodedToken = await cacheRemember({
    key: `nexus10:events:token:${token.slice(0, 16)}`,
    ttlSeconds: backendEnv.redisSessionTtlSeconds,
    loader: () => getAdminApp().auth().verifyIdToken(token),
  })

  const role = normalizeRole(decodedToken?.role)

  return {
    uid: String(decodedToken?.uid ?? ''),
    role,
    permissions: rolePermissions[role] ?? [],
    storeIds: Array.isArray(decodedToken?.storeIds) ? decodedToken.storeIds.map(String) : [],
  }
}

function setupSseHeaders(response: Response): void {
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  response.setHeader('Cache-Control', 'no-cache, no-transform')
  response.setHeader('Connection', 'keep-alive')
  response.setHeader('X-Accel-Buffering', 'no')
  response.flushHeaders?.()
}

export function registerEventRoutes(app: Express): void {
  app.get('/api/events', publicRateLimiter, async (request, response) => {
    try {
      const authUser = await authenticateEventRequest(request)

      if (!authUser.uid || !authUser.storeIds.length) {
        response.status(403).json({
          error: 'Sessao sem acesso a lojas para stream de eventos.',
        })
        return
      }

      setupSseHeaders(response)

      const client = registerEventClient({
        response,
        storeIds: authUser.storeIds,
        role: authUser.role,
        permissions: authUser.permissions,
        userId: authUser.uid,
      })

      request.on('close', () => client.close())
    } catch (error) {
      eventsLogger.warn(
        {
          context: 'events.connect',
          error: serializeError(error),
        },
        'Failed to open SSE stream',
      )

      if (!response.headersSent) {
        response.status(401).json({
          error: error instanceof Error ? error.message : 'Nao foi possivel abrir a stream SSE.',
        })
      }
    }
  })

  if (backendEnv.appEnv !== 'production') {
    app.post('/api/events/debug/publish', publicRateLimiter, expressJsonShim, async (request, response) => {
      try {
        const body = (request.body ?? {}) as Record<string, unknown>
        const event = await publishNotificationEvent({
          type: String(body.type ?? 'system.notice') as any,
          title: String(body.title ?? 'Teste SSE'),
          message: String(body.message ?? 'Evento manual disparado para teste.'),
          severity: String(body.severity ?? 'info') as any,
          storeId: body.storeId ? String(body.storeId) : null,
          tenantId: body.tenantId ? String(body.tenantId) : null,
          metadata: (body.metadata as Record<string, unknown> | undefined) ?? {},
          audience: (body.audience as any) ?? undefined,
          integration: body.integration ? String(body.integration) : null,
        })

        response.json({ data: event })
      } catch (error) {
        response.status(500).json({
          error: error instanceof Error ? error.message : 'Falha ao publicar evento debug.',
        })
      }
    })
  }
}

function expressJsonShim(request: Request, _response: Response, next: () => void) {
  if (request.body && typeof request.body === 'object') {
    next()
    return
  }

  let rawBody = ''
  request.setEncoding('utf8')
  request.on('data', (chunk) => {
    rawBody += chunk
  })
  request.on('end', () => {
    try {
      request.body = rawBody ? JSON.parse(rawBody) : {}
    } catch {
      request.body = {}
    }
    next()
  })
}
