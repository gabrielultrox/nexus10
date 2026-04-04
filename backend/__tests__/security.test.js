import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../config/env.js', () => ({
  backendEnv: {
    trustProxy: true,
    nodeEnv: 'production',
    appEnv: 'production',
    logLevel: 'silent',
    localOperatorPassword: '4321',
    openaiApiKey: null,
    frontendOrigin: ['https://nexus10-seguro-copia-2026-03-092036.vercel.app'],
    corsPreflightMaxAgeSeconds: 600,
    securityUserAgentBlocklist: ['sqlmap', 'nikto'],
    rateLimitTrustedIps: [],
    redisKeyPrefix: 'nexus10',
    redisUrl: '',
    apiRateLimitWindowMs: 15 * 60 * 1000,
    apiRateLimitMax: 300,
    authRateLimitMax: 20,
    ifoodAuthBaseUrl: 'https://merchant-api.ifood.com.br/authentication/v1.0',
    ifoodMerchantBaseUrl: 'https://merchant-api.ifood.com.br',
    ifoodEventsPollingPath: '/events/v1.0/events:polling',
    ifoodEventsAckPath: '/events/v1.0/events/acknowledgment',
    ifoodOrderDetailsPath: '/order/v1.0/orders',
    ifoodWebhookUrl: '',
    ifoodWebhookSecret: '',
    ifoodPollingIntervalSeconds: 30,
    firebaseProjectId: 'test-project',
    firebaseClientEmail: 'test@example.com',
    firebasePrivateKey: 'test-key',
  },
  ensureBackendEnvLoaded: () => ({
    nodeEnv: 'production',
  }),
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

vi.mock('../middleware/requireAuth.js', () => ({
  requireApiAuth: (_request, _response, next) => next(),
  requirePermission: () => (_request, _response, next) => next(),
  requireScopedStoreAccess: () => (_request, _response, next) => next(),
  requireStoreAccess: (_request, _response, next) => next(),
}))

vi.mock('../middleware/validateRequest.js', () => ({
  validateRequest: () => (_request, _response, next) => next(),
}))

vi.mock('../middleware/rateLimiter.js', () => ({
  authenticatedApiRateLimiter: (_request, _response, next) => next(),
  createRateLimitMiddleware: () => (_request, _response, next) => next(),
  fileUploadRateLimiter: (_request, _response, next) => next(),
  ifoodWebhookRateLimiter: (_request, _response, next) => next(),
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

vi.mock('../modules/finance/financeController.js', () => ({
  registerFinanceRoutes: () => {},
}))

vi.mock('../routes/ze-delivery.js', () => ({
  registerZeDeliveryRoutes: () => {},
}))

vi.mock('../integrations/ifood/ifoodFirestoreRepository.js', () => ({
  createIfoodFirestoreRepository: () => ({}),
}))

vi.mock('../integrations/ifood/ifoodIntegrationRuntime.js', () => ({
  createIfoodIntegrationRuntime: () => ({
    adapter: {
      getAccessToken: vi.fn(),
      getOrderDetails: vi.fn(),
    },
    eventService: {
      processPolling: vi.fn(),
      processWebhook: vi.fn(),
    },
    orderService: {
      upsertOrderFromDetails: vi.fn(),
    },
  }),
}))

vi.mock('../monitoring/sentry.js', () => ({
  initializeSentry: vi.fn(),
  sentryRequestContextMiddleware: (_request, _response, next) => next(),
  setupExpressSentry: vi.fn(),
  captureError: vi.fn(),
  buildMonitoredErrorPayload: (_error, context) => context,
}))

vi.mock('../repositories/integrationMerchantRepository.js', () => ({
  getIntegrationMerchant: vi.fn(),
  listIntegrationMerchants: vi.fn(),
  touchIntegrationMerchant: vi.fn(),
}))

let createApp
let buildContentSecurityPolicyDirectives
let createHelmetSecurityConfig
let isAllowedOrigin
let isBlockedUserAgent
let server
let baseUrl

beforeAll(async () => {
  ;({
    buildContentSecurityPolicyDirectives,
    createHelmetSecurityConfig,
    isAllowedOrigin,
    isBlockedUserAgent,
  } = await import('../config/security.js'))
  ;({ createApp } = await import('../app.ts'))
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

describe('backend security', () => {
  it('aceita apenas a origem publicada configurada', () => {
    expect(isAllowedOrigin('https://nexus10-seguro-copia-2026-03-092036.vercel.app')).toBe(true)
    expect(isAllowedOrigin('https://evil.example.com')).toBe(false)
    expect(isAllowedOrigin('javascript:alert(1)')).toBe(false)
    expect(isAllowedOrigin('https://user:pass@example.com')).toBe(false)
  })

  it('gera CSP e config do helmet com headers production-ready', () => {
    const csp = buildContentSecurityPolicyDirectives()
    const helmetConfig = createHelmetSecurityConfig()

    expect(csp.defaultSrc).toContain("'none'")
    expect(csp.frameAncestors).toContain("'none'")
    expect(csp.connectSrc).toContain('https://nexus10-seguro-copia-2026-03-092036.vercel.app')
    expect(helmetConfig.hsts.maxAge).toBe(31536000)
    expect(helmetConfig.noSniff).toBe(true)
    expect(helmetConfig.frameguard.action).toBe('deny')
  })

  it('bloqueia user-agent malicioso conhecido', () => {
    expect(isBlockedUserAgent('sqlmap/1.8')).toBe(true)
    expect(isBlockedUserAgent('Mozilla/5.0 Chrome/123')).toBe(false)
  })

  it('envia headers de seguranca esperados quando a requisicao e segura', async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: {
        'x-forwarded-proto': 'https',
      },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('strict-transport-security')).toContain('max-age=31536000')
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'")
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('permissions-policy')).toContain('camera=()')
    expect(response.headers.get('x-powered-by')).toBeNull()
  })

  it('expõe readiness operacional sem autenticação para smoke checks', async () => {
    const response = await fetch(`${baseUrl}/api/health/ready`, {
      headers: {
        'x-forwarded-proto': 'https',
      },
    })

    expect([200, 503]).toContain(response.status)

    const payload = await response.json()

    expect(payload.service).toBe('nexus10-backend')
    expect(payload.checks.firestore.status).toBeDefined()
    expect(payload.checks.metrics.status).toBe('ok')
    expect(payload.checks.scheduler.errorCount).toBeDefined()
  })

  it('rejeita origem CORS invalida', async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: {
        origin: 'https://evil.example.com',
        'x-forwarded-proto': 'https',
      },
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Origem nao autorizada para esta API.',
    })
  })

  it('aceita preflight com origem valida e cache de preflight', async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://nexus10-seguro-copia-2026-03-092036.vercel.app',
        'access-control-request-method': 'GET',
        'x-forwarded-proto': 'https',
      },
    })

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://nexus10-seguro-copia-2026-03-092036.vercel.app',
    )
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
    expect(response.headers.get('access-control-max-age')).toBe('600')
    expect(response.headers.get('vary')).toContain('Origin')
  })

  it('rejeita http em producao quando nao vier por https no proxy', async () => {
    const response = await fetch(`${baseUrl}/api/health`)

    expect(response.status).toBe(426)
    await expect(response.json()).resolves.toEqual({
      error: 'HTTPS obrigatorio neste ambiente.',
    })
  })

  it('rejeita user-agent bloqueado antes de processar a rota', async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: {
        'user-agent': 'sqlmap/1.8',
        'x-forwarded-proto': 'https',
      },
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'User-Agent bloqueado pela politica de seguranca.',
    })
  })
})
