import express from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  docs: [],
  collectionGroupName: '',
}))

vi.mock('../firebaseAdmin.js', () => ({
  getAdminFirestore: () => ({
    collectionGroup: (name) => {
      mockState.collectionGroupName = name

      return {
        where() {
          return this
        },
        orderBy() {
          return this
        },
        limit() {
          return this
        },
        async get() {
          return { docs: mockState.docs }
        },
      }
    },
  }),
}))

vi.mock('../logging/logger.js', () => ({
  createLoggerContext: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  serializeError: (error) => ({ message: error?.message ?? 'unknown' }),
}))

vi.mock('../middleware/requireAuth.js', () => ({
  requireRole: () => (request, _response, next) => {
    request.authUser = {
      uid: 'admin-1',
      role: 'admin',
      storeIds: ['store-a'],
      defaultStoreId: 'store-a',
    }
    next()
  },
}))

vi.mock('../middleware/validateRequest.js', () => ({
  validateRequest: () => (request, _response, next) => {
    request.validated = {
      query: {
        page: 1,
        limit: 50,
        actor: '',
        user: '',
        action: '',
        resource: '',
        module: '',
        entity: '',
        search: '',
        date: '',
      },
    }
    next()
  },
}))

vi.mock('../validation/schemas.js', () => ({
  adminAuditLogQuerySchema: {},
}))

let registerAdminAuditLogRoutes
let server
let baseUrl

beforeAll(async () => {
  ;({ registerAdminAuditLogRoutes } = await import('../modules/admin/auditLogController.js'))
  const app = express()
  app.use((request, _response, next) => {
    request.log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    next()
  })
  registerAdminAuditLogRoutes(app)
  server = app.listen(0)

  await new Promise((resolve) => {
    server.once('listening', resolve)
  })

  const address = server.address()
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
})

beforeEach(() => {
  mockState.collectionGroupName = ''
  mockState.docs = [
    {
      id: 'audit-1',
      ref: {
        path: 'stores/store-a/audit_logs/audit-1',
      },
      data: () => ({
        storeId: 'store-a',
        userId: 'user-1',
        actor: {
          id: 'user-1',
          name: 'Gabriel',
          role: 'admin',
        },
        action: 'update',
        module: 'customers',
        entityType: 'customer',
        entityId: 'customer-1',
        description: 'Cliente atualizado na base.',
        reason: 'Ajuste cadastral',
        ip: '127.0.0.1',
        requestId: 'req-1',
        timestampUtc: '2026-03-29T12:00:00.000Z',
        timestampLocal: '2026-03-29T09:00:00',
        timezone: 'America/Sao_Paulo',
        statusCode: 200,
        before: { name: 'Cliente antigo' },
        after: { name: 'Cliente novo' },
        metadata: { source: 'ui' },
      }),
    },
  ]
})

describe('admin audit logs route', () => {
  it('lists audit logs using the audit_logs collection group and returns rich fields', async () => {
    const response = await fetch(`${baseUrl}/api/admin/audit-logs`)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockState.collectionGroupName).toBe('audit_logs')
    expect(payload.data.items[0]).toMatchObject({
      id: 'audit-1',
      userId: 'user-1',
      actorName: 'Gabriel',
      module: 'customers',
      entityType: 'customer',
      entityId: 'customer-1',
      reason: 'Ajuste cadastral',
      ip: '127.0.0.1',
      requestId: 'req-1',
      before: { name: 'Cliente antigo' },
      after: { name: 'Cliente novo' },
    })
  })
})
