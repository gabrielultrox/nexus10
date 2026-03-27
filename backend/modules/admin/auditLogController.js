import { createLoggerContext, serializeError } from '../../logging/logger.js'
import { getAdminFirestore } from '../../firebaseAdmin.js'
import { requireRole } from '../../middleware/requireAuth.js'
import { validateRequest } from '../../middleware/validateRequest.js'
import { adminAuditLogQuerySchema } from '../../validation/schemas.js'

const auditLogAdminLogger = createLoggerContext({ module: 'admin.audit_logs' })

function asDate(value) {
  if (!value) {
    return null
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate()
  }

  const dateValue = new Date(value)
  return Number.isNaN(dateValue.getTime()) ? null : dateValue
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function resolveStoreIdFromPath(refPath = '') {
  const segments = String(refPath).split('/')
  const storesIndex = segments.indexOf('stores')

  if (storesIndex === -1 || storesIndex + 1 >= segments.length) {
    return ''
  }

  return segments[storesIndex + 1] ?? ''
}

function normalizeAuditLogDocument(documentSnapshot) {
  const data = documentSnapshot.data() ?? {}
  const createdAt = asDate(data.createdAt)
  const storeId = normalizeText(data.storeId) || resolveStoreIdFromPath(documentSnapshot.ref.path)

  return {
    id: documentSnapshot.id,
    storeId,
    actorId: normalizeText(data.actor?.id),
    actorName: normalizeText(data.actor?.name) || 'Sistema',
    actorRole: normalizeText(data.actor?.role),
    action: normalizeText(data.action),
    resource: normalizeText(data.entityType),
    resourceId: normalizeText(data.entityId),
    description: normalizeText(data.description),
    createdAt: createdAt ? createdAt.toISOString() : null,
    metadata: data.metadata ?? null,
  }
}

function matchesFilter(logEntry, filters) {
  const actorFilter = filters.actor.toLowerCase()
  const actionFilter = filters.action.toLowerCase()
  const resourceFilter = filters.resource.toLowerCase()

  if (actorFilter) {
    const actorText = [logEntry.actorName, logEntry.actorId, logEntry.actorRole]
      .join(' ')
      .toLowerCase()
    if (!actorText.includes(actorFilter)) {
      return false
    }
  }

  if (actionFilter && logEntry.action.toLowerCase() !== actionFilter) {
    return false
  }

  if (resourceFilter) {
    const resourceText = [logEntry.resource, logEntry.resourceId].join(' ').toLowerCase()
    if (!resourceText.includes(resourceFilter)) {
      return false
    }
  }

  if (filters.date) {
    const entryDate = logEntry.createdAt ? logEntry.createdAt.slice(0, 10) : ''
    if (entryDate !== filters.date) {
      return false
    }
  }

  return true
}

function chunkArray(values, chunkSize = 10) {
  const chunks = []

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize))
  }

  return chunks
}

async function listAuditLogsForStores(storeIds, filters) {
  const firestore = getAdminFirestore()
  const fetchWindow = Math.min(Math.max(filters.page * filters.limit * 4, 200), 1000)
  const storeChunks = chunkArray(storeIds, 10)
  const snapshots = await Promise.all(
    storeChunks.map((storeChunk) => {
      let currentQuery = firestore
        .collectionGroup('auditLogs')
        .where('storeId', 'in', storeChunk)
        .orderBy('createdAt', 'desc')
        .limit(fetchWindow)

      if (filters.date) {
        const start = new Date(`${filters.date}T00:00:00.000Z`)
        const end = new Date(`${filters.date}T23:59:59.999Z`)
        currentQuery = currentQuery.where('createdAt', '>=', start).where('createdAt', '<=', end)
      }

      return currentQuery.get()
    }),
  )

  return snapshots
    .flatMap((snapshot) => snapshot.docs.map(normalizeAuditLogDocument))
    .filter((entry) => matchesFilter(entry, filters))
    .sort((left, right) => {
      const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0
      const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0
      return rightTime - leftTime
    })
}

export function registerAdminAuditLogRoutes(app) {
  app.get(
    '/api/admin/audit-logs',
    requireRole('admin'),
    validateRequest(adminAuditLogQuerySchema, { source: 'query' }),
    async (request, response) => {
      const filters = request.validated?.query ?? {}
      const accessibleStoreIds = Array.from(new Set(request.authUser?.storeIds ?? [])).filter(
        Boolean,
      )

      if (!accessibleStoreIds.length) {
        response.json({
          data: {
            items: [],
            pagination: {
              page: filters.page,
              limit: filters.limit,
              total: 0,
              pages: 0,
            },
            filters,
          },
        })
        return
      }

      try {
        const items = await listAuditLogsForStores(accessibleStoreIds, filters)
        const total = items.length
        const pages = total === 0 ? 0 : Math.ceil(total / filters.limit)
        const startIndex = (filters.page - 1) * filters.limit
        const paginatedItems = items.slice(startIndex, startIndex + filters.limit)

        ;(request.log ?? auditLogAdminLogger).info(
          {
            context: 'admin.audit_logs.list',
            actorId: request.authUser?.uid ?? null,
            page: filters.page,
            limit: filters.limit,
            total,
            filters,
          },
          'Audit logs listed',
        )

        response.json({
          data: {
            items: paginatedItems,
            pagination: {
              page: filters.page,
              limit: filters.limit,
              total,
              pages,
            },
            filters,
          },
        })
      } catch (error) {
        ;(request.log ?? auditLogAdminLogger).error(
          {
            context: 'admin.audit_logs.list',
            actorId: request.authUser?.uid ?? null,
            filters,
            error: serializeError(error),
          },
          'Failed to list audit logs',
        )

        response.status(500).json({
          error: 'Nao foi possivel carregar os logs de auditoria.',
        })
      }
    },
  )
}
