import { beforeEach, describe, expect, it, vi } from 'vitest'

const firestoreState = vi.hoisted(() => ({
  writes: [],
}))

vi.mock('../firebaseAdmin.js', () => ({
  getAdminFirestore: () => ({
    collection: () => ({
      doc: (storeId) => ({
        collection: () => ({
          doc: (reportId) => ({
            async set(payload) {
              firestoreState.writes.push({ storeId, reportId, payload })
            },
          }),
        }),
      }),
    }),
  }),
  getAdminStorageBucket: () => ({
    file: () => ({
      async save() {},
      async download() {
        return [Buffer.from('report')]
      },
    }),
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

describe('report generation queue', () => {
  beforeEach(() => {
    firestoreState.writes = []
    vi.stubGlobal('setImmediate', vi.fn())
  })

  it('persists queued metadata before background processing', async () => {
    const { queueReportGeneration } = await import('../services/reportBuilder.ts')

    const result = await queueReportGeneration({
      storeId: 'store-a',
      type: 'sales',
      format: 'excel',
      filters: {
        startDate: '2026-03-01',
        endDate: '2026-03-29',
        operator: '',
        module: '',
        template: 'default',
      },
      actor: {
        uid: 'admin-1',
        email: 'admin@test.com',
        displayName: 'Admin',
        operatorName: 'Admin',
        role: 'admin',
        tenantId: 'tenant-1',
        storeIds: ['store-a'],
        defaultStoreId: 'store-a',
        isAnonymous: false,
        claims: {},
      },
    })

    expect(result.id).toContain('report-')
    expect(result.status).toBe('queued')
    expect(result.type).toBe('sales')
    expect(result.format).toBe('excel')
    expect(firestoreState.writes).toHaveLength(1)
    expect(firestoreState.writes[0]).toMatchObject({
      storeId: 'store-a',
      payload: expect.objectContaining({
        status: 'queued',
        format: 'excel',
        type: 'sales',
      }),
    })
  })
})
