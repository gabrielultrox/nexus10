import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('./config/env.js', () => ({
  backendEnv: {
    nodeEnv: 'production',
    logLevel: 'silent',
    localOperatorPassword: '4321',
    openaiApiKey: null,
    frontendOrigin: ['https://nexus10.vercel.app'],
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
  hasFirebaseAdminConfig: () => true,
}));

vi.mock('./logging/logger.js', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
  serializeError: (error) => ({
    message: error?.message ?? 'unknown',
  }),
}));

vi.mock('./middleware/requestLogger.js', () => ({
  requestLogger: (request, _response, next) => {
    request.log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    next();
  },
}));

vi.mock('./middleware/requireAuth.js', () => ({
  requireApiAuth: (_request, _response, next) => next(),
  requireStoreAccess: (_request, _response, next) => next(),
}));

vi.mock('./middleware/validateRequest.js', () => ({
  validateRequest: () => (_request, _response, next) => next(),
}));

vi.mock('./modules/auth/authController.js', () => ({
  registerAuthRoutes: () => {},
}));

vi.mock('./modules/orders/orderController.js', () => ({
  registerOrderRoutes: () => {},
}));

vi.mock('./modules/sales/saleController.js', () => ({
  registerSaleRoutes: () => {},
}));

vi.mock('./modules/assistant/assistantController.js', () => ({
  registerAssistantRoutes: () => {},
}));

vi.mock('./modules/admin/auditLogController.js', () => ({
  registerAdminAuditLogRoutes: () => {},
}));

vi.mock('./integrations/ifood/ifoodFirestoreRepository.js', () => ({
  createIfoodFirestoreRepository: () => ({}),
}));

vi.mock('./integrations/ifood/ifoodIntegrationRuntime.js', () => ({
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
}));

vi.mock('./repositories/integrationMerchantRepository.js', () => ({
  getIntegrationMerchant: vi.fn(),
  listIntegrationMerchants: vi.fn(),
  touchIntegrationMerchant: vi.fn(),
}));

let createApp;
let isAllowedOrigin;
let buildContentSecurityPolicyDirectives;
let server;
let baseUrl;

beforeAll(async () => {
  ({ createApp, isAllowedOrigin, buildContentSecurityPolicyDirectives } = await import('./app.js'));
  server = createApp().listen(0);

  await new Promise((resolve) => {
    server.once('listening', resolve);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (!server) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

describe('backend app security', () => {
  it('valida origens permitidas com parse estrito', () => {
    expect(isAllowedOrigin('https://nexus10.vercel.app')).toBe(true);
    expect(isAllowedOrigin('https://evil.com')).toBe(false);
    expect(isAllowedOrigin('javascript:alert(1)')).toBe(false);
    expect(isAllowedOrigin('https://user:pass@nexus10.vercel.app')).toBe(false);
  });

  it('define uma CSP restritiva para a API', () => {
    const directives = buildContentSecurityPolicyDirectives();

    expect(directives.defaultSrc).toContain("'none'");
    expect(directives.frameAncestors).toContain("'none'");
    expect(directives.connectSrc).toContain('https://nexus10.vercel.app');
  });

  it('remove x-powered-by e envia headers de seguranca', async () => {
    const response = await fetch(`${baseUrl}/api/health`);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-powered-by')).toBeNull();
    expect(response.headers.get('strict-transport-security')).toContain('max-age=31536000');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
  });

  it('bloqueia origem nao autorizada', async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: {
        Origin: 'https://evil.com',
      },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Origem nao autorizada para esta API.',
    });
  });

  it('aceita origem autorizada e retorna cabecalho CORS correto', async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: {
        Origin: 'https://nexus10.vercel.app',
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://nexus10.vercel.app');
    expect(response.headers.get('vary')).toContain('Origin');
  });
});
