import express from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  currentAuthUser: {
    uid: 'admin-1',
    role: 'admin',
    storeIds: ['store-a'],
    defaultStoreId: 'store-a',
  },
  listIntegrationMerchants: vi.fn(),
  getIntegrationMerchant: vi.fn(),
  touchIntegrationMerchant: vi.fn(),
  upsertFinancialEntry: vi.fn(),
  upsertFinancialClosure: vi.fn(),
}))

vi.mock('../config/env.js', () => ({
  backendEnv: {
    trustProxy: false,
    nodeEnv: 'development',
    appEnv: 'development',
    logLevel: 'info',
    localOperatorPassword: '1234',
    openaiApiKey: null,
    frontendOrigin: [],
    corsPreflightMaxAgeSeconds: 600,
    securityUserAgentBlocklist: [],
    rateLimitTrustedIps: [],
    redisKeyPrefix: 'nexus10',
    redisUrl: '',
    redisSocketTimeoutMs: 5000,
    redisSessionTtlSeconds: 300,
    redisMerchantTtlSeconds: 180,
    redisProductTtlSeconds: 120,
    apiRateLimitWindowMs: 60000,
    apiRateLimitMax: 100,
    authRateLimitMax: 20,
    sentryDsn: '',
    sentryRelease: '',
    sentryTracesSampleRate: 0,
    monitoringWindowMs: 900000,
    alertCooldownMs: 600000,
    alertDiscordWebhookUrl: '',
    alertErrorRateThresholdPercent: 5,
    alertLatencyP95ThresholdMs: 1000,
    firebaseProjectId: 'test-project',
    firebaseClientEmail: 'firebase-adminsdk@test-project.iam.gserviceaccount.com',
    firebasePrivateKey: 'test-key',
    firestoreEmulatorHost: '',
    firebaseAuthEmulatorHost: '',
  },
  ensureBackendEnvLoaded: () => ({}),
  hasFirebaseAdminConfig: () => true,
}))

vi.mock('../logging/logger.js', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
  createLoggerContext: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  serializeError: (error) => ({
    message: error?.message ?? 'unknown',
  }),
}))

vi.mock('../middleware/requestLogger.js', () => ({
  requestLogger: (request, _response, next) => {
    request.log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    next()
  },
}))

vi.mock('../middleware/requireAuth.js', async () => {
  const actual = await vi.importActual('../middleware/requireAuth.js')

  return {
    ...actual,
    requireApiAuth: (request, _response, next) => {
      request.authUser = mockState.currentAuthUser
      next()
    },
  }
})

vi.mock('../middleware/rateLimiter.js', () => ({
  authenticatedApiRateLimiter: (_request, _response, next) => next(),
  createRateLimitMiddleware: () => (_request, _response, next) => next(),
  fileUploadRateLimiter: (_request, _response, next) => next(),
  merchantWebhookRateLimiter: (_request, _response, next) => next(),
  loginRateLimiter: (_request, _response, next) => next(),
  publicRateLimiter: (_request, _response, next) => next(),
}))

vi.mock('../modules/auth/authController.js', () => ({
  registerAuthRoutes: () => {},
}))

vi.mock('../modules/orders/orderController.js', () => ({
  registerOrderRoutes: () => {},
}))

vi.mock('../modules/sales/saleController.js', () => ({
  registerSaleRoutes: () => {},
}))

vi.mock('../modules/assistant/assistantController.js', () => ({
  registerAssistantRoutes: () => {},
}))

vi.mock('../modules/admin/auditLogController.js', () => ({
  registerAdminAuditLogRoutes: () => {},
}))

vi.mock('../modules/admin/monitoringController.js', () => ({
  registerMonitoringRoutes: () => {},
}))

vi.mock('../monitoring/sentry.js', () => ({
  initializeSentry: vi.fn(),
  sentryRequestContextMiddleware: (_request, _response, next) => next(),
  setupExpressSentry: vi.fn(),
  captureError: vi.fn(),
  buildMonitoredErrorPayload: (_error, context) => context,
}))

vi.mock('../repositories/integrationMerchantRepository.js', () => ({
  listIntegrationMerchants: mockState.listIntegrationMerchants,
  getIntegrationMerchant: mockState.getIntegrationMerchant,
  touchIntegrationMerchant: mockState.touchIntegrationMerchant,
}))

vi.mock('../modules/finance/financeRepository.js', () => ({
  createFinanceRepository: () => ({
    upsertFinancialEntry: mockState.upsertFinancialEntry,
    upsertFinancialClosure: mockState.upsertFinancialClosure,
  }),
}))

let createApp
let requireScopedStoreAccess
let server
let baseUrl

beforeAll(async () => {
  ;({ createApp } = await import('../app.ts'))
  ;({ requireScopedStoreAccess } = await import('../middleware/requireAuth.js'))
  server = createApp().listen(0)

  await new Promise((resolve) => {
    server.once('listening', resolve)
  })

  const address = server.address()
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  if (!server) {
    return
  }

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
  mockState.currentAuthUser = {
    uid: 'admin-1',
    role: 'admin',
    storeIds: ['store-a'],
    defaultStoreId: 'store-a',
  }
  mockState.listIntegrationMerchants.mockReset()
  mockState.getIntegrationMerchant.mockReset()
  mockState.touchIntegrationMerchant.mockReset()
  mockState.upsertFinancialEntry.mockReset()
  mockState.upsertFinancialClosure.mockReset()
})

describe('backend authorization and permissions', () => {
  it('blocks finance entry creation for a role without finance:write', async () => {
    mockState.currentAuthUser = {
      uid: 'operator-1',
      role: 'operador',
      storeIds: ['store-a'],
      defaultStoreId: 'store-a',
    }

    const response = await fetch(`${baseUrl}/api/finance/entries`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: 'entrada',
        amount: 12.5,
        description: 'Ajuste de caixa',
        date: '2026-03-27T15:00:00.000Z',
      }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Seu perfil nao tem permissao para esta acao.',
    })
    expect(mockState.upsertFinancialEntry).not.toHaveBeenCalled()
  })

  it('allows finance entry creation for a role with finance:write', async () => {
    mockState.currentAuthUser = {
      uid: 'manager-1',
      role: 'gerente',
      storeIds: ['store-a'],
      defaultStoreId: 'store-a',
    }

    const response = await fetch(`${baseUrl}/api/finance/entries`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: 'entrada',
        amount: 12.5,
        description: 'Ajuste de caixa',
        date: '2026-03-27T15:00:00.000Z',
      }),
    })
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.data.storeId).toBe('store-a')
    expect(mockState.upsertFinancialEntry).toHaveBeenCalledTimes(1)
  })

  it('enforces scoped store access for query parameters used by integration dashboards', async () => {
    const app = express()

    app.use((request, _response, next) => {
      request.authUser = {
        uid: 'admin-1',
        role: 'admin',
        storeIds: ['store-a'],
        defaultStoreId: 'store-a',
      }
      request.validated = {
        query: request.query,
      }
      next()
    })

    app.get(
      '/dashboard',
      requireScopedStoreAccess({ source: 'query', field: 'storeId', required: false }),
      (_request, response) => {
        response.json({ ok: true })
      },
    )

    const localServer = app.listen(0)
    await new Promise((resolve) => {
      localServer.once('listening', resolve)
    })
    const address = localServer.address()
    const localBaseUrl = `http://127.0.0.1:${address.port}`

    const denied = await fetch(`${localBaseUrl}/dashboard?storeId=store-b`)
    const allowedWithoutStore = await fetch(`${localBaseUrl}/dashboard`)

    expect(denied.status).toBe(403)
    await expect(denied.json()).resolves.toEqual({
      error: 'Seu perfil nao tem acesso a esta loja.',
    })
    expect(allowedWithoutStore.status).toBe(200)

    await new Promise((resolve, reject) => {
      localServer.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  })
})
