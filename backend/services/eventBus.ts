import { randomUUID } from 'node:crypto'

import type { Response } from 'express'

import { cacheSet } from '../cache/cacheService.js'
import { createLoggerContext, serializeError } from '../logging/logger.js'

export type NotificationEventType =
  | 'order.created'
  | 'order.status.changed'
  | 'machine.confirmed'
  | 'delivery.delayed'
  | 'cash.critical'
  | 'integration.alert'
  | 'system.notice'

export interface NotificationEventPayload {
  id: string
  type: NotificationEventType
  title: string
  message: string
  severity: 'info' | 'success' | 'warning' | 'error'
  storeId: string | null
  tenantId: string | null
  audience?: {
    roles?: string[]
    permissions?: string[]
    userIds?: string[]
  }
  metadata?: Record<string, unknown>
  integration?: string | null
  createdAt: string
}

interface EventClient {
  id: string
  response: Response
  storeIds: Set<string>
  role: string | null
  permissions: Set<string>
  userId: string | null
}

const HEARTBEAT_INTERVAL_MS = 20_000
const EVENT_CACHE_TTL_SECONDS = 300
const eventBusLogger = createLoggerContext({ module: 'event-bus' })
const clients = new Map<string, EventClient>()

function toSet(values: string[] | undefined | null): Set<string> {
  return new Set((values ?? []).map(String).filter(Boolean))
}

function clientMatchesAudience(client: EventClient, event: NotificationEventPayload): boolean {
  if (event.storeId && !client.storeIds.has(event.storeId)) {
    return false
  }

  const audience = event.audience

  if (!audience) {
    return true
  }

  if (audience.userIds?.length && (!client.userId || !audience.userIds.includes(client.userId))) {
    return false
  }

  if (audience.roles?.length && (!client.role || !audience.roles.includes(client.role))) {
    return false
  }

  if (
    audience.permissions?.length &&
    !audience.permissions.some((permission) => client.permissions.has(permission))
  ) {
    return false
  }

  return true
}

function writeSseChunk(response: Response, eventName: string, payload: unknown): void {
  response.write(`event: ${eventName}\n`)
  response.write(`data: ${JSON.stringify(payload)}\n\n`)
}

let heartbeatHandle: NodeJS.Timeout | null = null

function ensureHeartbeatLoop(): void {
  if (heartbeatHandle) {
    return
  }

  heartbeatHandle = setInterval(() => {
    for (const client of clients.values()) {
      try {
        client.response.write(': ping\n\n')
      } catch (error) {
        eventBusLogger.warn(
          {
            context: 'event_bus.heartbeat',
            clientId: client.id,
            error: serializeError(error),
          },
          'Failed to write SSE heartbeat',
        )
        try {
          client.response.end()
        } catch {}
        clients.delete(client.id)
      }
    }

    if (!clients.size && heartbeatHandle) {
      clearInterval(heartbeatHandle)
      heartbeatHandle = null
    }
  }, HEARTBEAT_INTERVAL_MS)
}

export function registerEventClient(input: {
  response: Response
  storeIds: string[]
  role?: string | null
  permissions?: string[]
  userId?: string | null
}): { clientId: string; close: () => void } {
  const clientId = randomUUID()
  const client: EventClient = {
    id: clientId,
    response: input.response,
    storeIds: toSet(input.storeIds),
    role: input.role ?? null,
    permissions: toSet(input.permissions),
    userId: input.userId ?? null,
  }

  clients.set(clientId, client)
  ensureHeartbeatLoop()
  writeSseChunk(input.response, 'connected', {
    clientId,
    timestamp: new Date().toISOString(),
  })

  return {
    clientId,
    close() {
      clients.delete(clientId)
      try {
        input.response.end()
      } catch {}
    },
  }
}

export async function publishNotificationEvent(
  input: Omit<NotificationEventPayload, 'id' | 'createdAt'> & {
    id?: string
    createdAt?: string
  },
): Promise<NotificationEventPayload> {
  const event: NotificationEventPayload = {
    id: input.id ?? randomUUID(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    audience: input.audience,
    integration: input.integration ?? null,
    metadata: input.metadata ?? {},
    ...input,
  }

  await cacheSet(`nexus10:events:last:${event.id}`, event, EVENT_CACHE_TTL_SECONDS).catch(() => false)

  for (const client of clients.values()) {
    if (!clientMatchesAudience(client, event)) {
      continue
    }

    try {
      writeSseChunk(client.response, 'notification', event)
    } catch (error) {
      eventBusLogger.warn(
        {
          context: 'event_bus.publish',
          clientId: client.id,
          eventId: event.id,
          error: serializeError(error),
        },
        'Failed to deliver notification event',
      )
      try {
        client.response.end()
      } catch {}
      clients.delete(client.id)
    }
  }

  return event
}

export function getEventBusStats() {
  return {
    connectedClients: clients.size,
  }
}
