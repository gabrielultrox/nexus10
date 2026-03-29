import { createAuditRepository } from '../modules/audit/auditRepository.js'
import { createLoggerContext, serializeError } from '../logging/logger.js'
import { publishNotificationEvent } from './eventBus.js'

type AuditAction = 'create' | 'update' | 'delete' | 'approve' | 'reject'

interface AuditActor {
  id: string | null
  name: string
  role: string
}

interface AuditLogPayload {
  storeId: string
  tenantId?: string | null
  userId?: string | null
  action: AuditAction
  module: string
  entityType: string
  entityId: string
  description: string
  reason?: string | null
  before?: unknown
  after?: unknown
  metadata?: Record<string, unknown> | null
  actor?: Partial<AuditActor> | null
  ip?: string | null
  method?: string | null
  path?: string | null
  requestId?: string | null
  statusCode?: number | null
  timezone?: string | null
  timestampUtc?: string
  timestampLocal?: string
  notifyAdmin?: boolean
}

const auditLogger = createLoggerContext({ module: 'audit.service' })
const repository = createAuditRepository()

function sanitizeValue<TValue>(value: TValue): TValue | null {
  if (value == null) {
    return null
  }

  try {
    return JSON.parse(
      JSON.stringify(value, (_key, currentValue) => {
        if (currentValue instanceof Date) {
          return currentValue.toISOString()
        }

        return currentValue
      }),
    ) as TValue
  } catch {
    return null
  }
}

function buildActor(actor: AuditLogPayload['actor']): AuditActor {
  return {
    id: actor?.id ?? null,
    name: String(actor?.name ?? 'Sistema').trim() || 'Sistema',
    role: String(actor?.role ?? 'system').trim() || 'system',
  }
}

function buildLocalTimestamp(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year ?? '0000'}-${map.month ?? '00'}-${map.day ?? '00'}T${map.hour ?? '00'}:${map.minute ?? '00'}:${map.second ?? '00'}`
}

function shouldNotifyAdmin(payload: AuditLogPayload): boolean {
  if (payload.notifyAdmin) {
    return true
  }

  if (payload.action === 'delete' && payload.module === 'sales') {
    return true
  }

  if (payload.module === 'customers' && payload.action === 'update') {
    return true
  }

  return false
}

async function emitAdminAlert(payload: AuditLogPayload): Promise<void> {
  if (!shouldNotifyAdmin(payload)) {
    return
  }

  await publishNotificationEvent({
    type: 'system.notice',
    title: 'Alerta de auditoria',
    message: payload.description,
    severity: payload.action === 'delete' ? 'error' : 'warning',
    storeId: payload.storeId,
    tenantId: payload.tenantId ?? null,
    audience: {
      roles: ['admin'],
    },
    metadata: {
      module: payload.module,
      entityType: payload.entityType,
      entityId: payload.entityId,
      action: payload.action,
      reason: payload.reason ?? null,
      requestId: payload.requestId ?? null,
    },
  })
}

export async function recordAuditEvent(payload: AuditLogPayload): Promise<string | null> {
  if (
    !payload.storeId ||
    !payload.action ||
    !payload.module ||
    !payload.entityType ||
    !payload.entityId
  ) {
    return null
  }

  const timestamp = payload.timestampUtc ? new Date(payload.timestampUtc) : new Date()
  const timezone =
    payload.timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const actor = buildActor(payload.actor)

  const documentId = await repository.createAuditLog({
    storeId: payload.storeId,
    payload: {
      storeId: payload.storeId,
      tenantId: payload.tenantId ?? null,
      userId: payload.userId ?? actor.id ?? null,
      action: payload.action,
      module: payload.module,
      entityType: payload.entityType,
      entityId: payload.entityId,
      description: payload.description,
      reason: payload.reason ?? null,
      before: sanitizeValue(payload.before),
      after: sanitizeValue(payload.after),
      metadata: sanitizeValue(payload.metadata) ?? {},
      actor,
      ip: payload.ip ?? null,
      method: payload.method ?? null,
      path: payload.path ?? null,
      requestId: payload.requestId ?? null,
      statusCode: payload.statusCode ?? null,
      timestampUtc: timestamp.toISOString(),
      timestampLocal: payload.timestampLocal ?? buildLocalTimestamp(timestamp, timezone),
      timezone,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  })

  await emitAdminAlert(payload)

  return documentId
}

export function queueAuditEvent(payload: AuditLogPayload): void {
  setImmediate(() => {
    void recordAuditEvent(payload).catch((error) => {
      auditLogger.error(
        {
          context: 'audit.queue',
          storeId: payload.storeId,
          entityType: payload.entityType,
          entityId: payload.entityId,
          action: payload.action,
          error: serializeError(error),
        },
        'Failed to persist audit log',
      )
    })
  })
}
