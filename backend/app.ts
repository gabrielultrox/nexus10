import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import { backendEnv } from './config/env.js';
import { RequestValidationError } from './errors/RequestValidationError.js';
import { logger, serializeError } from './logging/logger.js';
import { registerAuthRoutes } from './modules/auth/authController.js';
import { createIfoodFirestoreRepository } from './integrations/ifood/ifoodFirestoreRepository.js';
import { createIfoodIntegrationRuntime } from './integrations/ifood/ifoodIntegrationRuntime.js';
import { requireApiAuth, requireStoreAccess } from './middleware/requireAuth.js';
import { requestLogger } from './middleware/requestLogger.js';
import { validateRequest } from './middleware/validateRequest.js';
import { registerAssistantRoutes } from './modules/assistant/assistantController.js';
import { registerAdminAuditLogRoutes } from './modules/admin/auditLogController.js';
import { registerOrderRoutes } from './modules/orders/orderController.js';
import { registerSaleRoutes } from './modules/sales/saleController.js';
import { swaggerSpec, swaggerUiOptions } from './swagger.js';
import {
  getIntegrationMerchant,
  listIntegrationMerchants,
  touchIntegrationMerchant,
} from './repositories/integrationMerchantRepository.js';
import {
  ifoodOrderSyncParamsSchema,
  ifoodPollingSchema,
  ifoodWebhookSchema,
} from './validation/schemas.js';

interface HealthResponseBody {
  status: 'ok';
  service: string;
  timestamp: string;
}

interface IfoodAccessToken {
  accessToken?: string;
  access_token?: string;
}

function isDevelopmentEnvironment(): boolean {
  return backendEnv.nodeEnv !== 'production';
}

function normalizeOrigin(origin?: string | null): string {
  if (!origin) {
    return '';
  }

  try {
    const parsedOrigin = new URL(origin);

    if (!['http:', 'https:'].includes(parsedOrigin.protocol)) {
      return '';
    }

    if (parsedOrigin.username || parsedOrigin.password) {
      return '';
    }

    return parsedOrigin.origin;
  } catch {
    return '';
  }
}

export function isAllowedOrigin(origin?: string | null): boolean {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return false;
  }

  if (backendEnv.frontendOrigin.map(normalizeOrigin).includes(normalizedOrigin)) {
    return true;
  }

  if (isDevelopmentEnvironment()) {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin);
  }

  return false;
}

export function buildContentSecurityPolicyDirectives(): Record<string, string[]> {
  const allowedConnectSources = [
    "'self'",
    ...backendEnv.frontendOrigin
      .map(normalizeOrigin)
      .filter(Boolean),
  ];

  if (isDevelopmentEnvironment()) {
    allowedConnectSources.push('http://localhost:*', 'http://127.0.0.1:*');
  }

  return {
    defaultSrc: ["'none'"],
    baseUri: ["'none'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    objectSrc: ["'none'"],
    imgSrc: ["'self'", 'data:'],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    connectSrc: Array.from(new Set(allowedConnectSources)),
    upgradeInsecureRequests: [],
  };
}

function createApiRateLimiter(max: number) {
  return rateLimit({
    windowMs: backendEnv.apiRateLimitWindowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Limite de requisicoes excedido. Aguarde antes de tentar novamente.',
    },
  });
}

export function createApp(): Express {
  const app = express();
  const repository = createIfoodFirestoreRepository();
  const appLogger = logger.child({ context: 'app' });
  const runtime = createIfoodIntegrationRuntime({
    env: backendEnv,
    repositories: repository,
  });

  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: buildContentSecurityPolicyDirectives(),
    },
    crossOriginResourcePolicy: false,
    frameguard: {
      action: 'deny',
    },
    hsts: backendEnv.nodeEnv === 'production'
      ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      }
      : false,
    referrerPolicy: {
      policy: 'no-referrer',
    },
  }));

  app.use((request: Request, response: Response, next: NextFunction) => {
    const origin = request.headers.origin;
    const normalizedOrigin = normalizeOrigin(origin);

    if (!origin) {
      next();
      return;
    }

    if (!normalizedOrigin || !isAllowedOrigin(normalizedOrigin)) {
      response.status(403).json({
        error: 'Origem nao autorizada para esta API.',
      });
      return;
    }

    response.header('Access-Control-Allow-Origin', normalizedOrigin);
    response.header('Vary', 'Origin');
    response.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    response.header('Access-Control-Allow-Credentials', 'true');

    if (request.method === 'OPTIONS') {
      response.status(204).end();
      return;
    }

    next();
  });

  app.use('/api', express.json());
  app.use('/api', createApiRateLimiter(backendEnv.apiRateLimitMax));
  app.use('/api/auth/session', createApiRateLimiter(backendEnv.authRateLimitMax));
  app.use('/webhooks/ifood', express.text({ type: '*/*' }));

  app.get('/api/health', (_request: Request, response: Response<HealthResponseBody>) => {
    response.json({
      status: 'ok',
      service: 'nexus-ifood-integration',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api-docs.json', (_request: Request, response: Response) => {
    response.json(swaggerSpec);
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  registerAuthRoutes(app);
  app.use('/api', requireApiAuth);
  registerAdminAuditLogRoutes(app);
  app.use('/api/stores/:storeId', requireStoreAccess);

  registerOrderRoutes(app);
  registerSaleRoutes(app);
  registerAssistantRoutes(app);

  app.get('/api/integrations/ifood/merchants/:storeId', async (request, response) => {
    try {
      const merchants = await listIntegrationMerchants({
        storeId: request.params.storeId,
        source: 'ifood',
      });

      response.json({
        data: merchants,
      });
    } catch (error) {
      request.log?.error({
        context: 'ifood.merchants.list',
        storeId: request.params.storeId,
        error: serializeError(error),
      }, 'Failed to list iFood merchants');
      response.status(500).json({
        error: error instanceof Error ? error.message : 'Nao foi possivel listar os merchants do iFood.',
      });
    }
  });

  app.post('/api/integrations/ifood/polling/run', validateRequest(ifoodPollingSchema), async (request, response) => {
    const { storeId, merchantId } = (request.validated?.body ?? request.body ?? {}) as {
      storeId: string;
      merchantId: string;
    };

    try {
      const merchant = await getIntegrationMerchant({
        storeId,
        merchantId,
        source: 'ifood',
      });

      if (!merchant) {
        response.status(404).json({
          error: 'Merchant iFood nao encontrado para a loja informada.',
        });
        return;
      }

      const authToken = await runtime.adapter.getAccessToken({
        clientId: merchant.clientId,
        clientSecret: merchant.clientSecret,
      }) as IfoodAccessToken;

      const pollingResult = await runtime.eventService.processPolling({
        storeId,
        tenantId: merchant.tenantId ?? null,
        merchant,
        accessToken: authToken.accessToken ?? authToken.access_token,
      });

      await touchIntegrationMerchant({
        storeId,
        merchantId,
        updates: {
          lastPollingAt: new Date().toISOString(),
          lastSyncAt: new Date().toISOString(),
          lastSyncError: null,
        },
      });

      response.json({
        ok: true,
        data: pollingResult,
      });
    } catch (error) {
      request.log?.error({
        context: 'ifood.polling.run',
        storeId,
        merchantId,
        error: serializeError(error),
      }, 'Failed to run iFood polling');
      await touchIntegrationMerchant({
        storeId,
        merchantId,
        updates: {
          lastSyncError: error instanceof Error ? error.message : 'Falha no polling do iFood.',
        },
      }).catch(() => {});

      response.status(500).json({
        error: error instanceof Error ? error.message : 'Nao foi possivel executar o polling do iFood.',
      });
    }
  });

  app.post('/api/integrations/ifood/orders/:storeId/:merchantId/:orderId/sync', validateRequest(ifoodOrderSyncParamsSchema, {
    source: 'params',
    mapRequest: (request: Request) => request.params,
  }), async (request, response) => {
    const { storeId, merchantId, orderId } = (request.validated?.params ?? request.params) as {
      storeId: string;
      merchantId: string;
      orderId: string;
    };

    try {
      const merchant = await getIntegrationMerchant({
        storeId,
        merchantId,
        source: 'ifood',
      });

      if (!merchant) {
        response.status(404).json({
          error: 'Merchant iFood nao encontrado para a loja informada.',
        });
        return;
      }

      const authToken = await runtime.adapter.getAccessToken({
        clientId: merchant.clientId,
        clientSecret: merchant.clientSecret,
      }) as IfoodAccessToken;
      const rawOrder = await runtime.adapter.getOrderDetails({
        accessToken: authToken.accessToken ?? authToken.access_token,
        orderId,
      });
      const normalizedOrder = await runtime.orderService.upsertOrderFromDetails({
        storeId,
        tenantId: merchant.tenantId ?? null,
        merchant,
        rawOrder,
        syncContext: {
          syncedAt: new Date().toISOString(),
        },
      });

      response.json({
        ok: true,
        data: normalizedOrder,
      });
    } catch (error) {
      request.log?.error({
        context: 'ifood.order.sync',
        storeId,
        merchantId,
        orderId,
        error: serializeError(error),
      }, 'Failed to sync iFood order');
      response.status(500).json({
        error: error instanceof Error ? error.message : 'Nao foi possivel sincronizar o pedido do iFood.',
      });
    }
  });

  app.post('/webhooks/ifood/:storeId/:merchantId', validateRequest(ifoodWebhookSchema, {
    source: 'webhook',
    mapRequest: (request: Request) => ({
      signature: request.header('X-IFood-Signature'),
      body: String(request.body ?? ''),
    }),
  }), async (request, response) => {
    const { storeId, merchantId } = request.params;
    const validatedWebhook = (request.validated?.webhook ?? {}) as {
      signature: string;
      body: string;
    };
    const signature = validatedWebhook.signature;
    const rawBody = validatedWebhook.body;

    try {
      const merchant = await getIntegrationMerchant({
        storeId,
        merchantId,
        source: 'ifood',
      });

      if (!merchant) {
        response.status(404).json({
          error: 'Merchant iFood nao encontrado para esta loja.',
        });
        return;
      }

      const authToken = await runtime.adapter.getAccessToken({
        clientId: merchant.clientId,
        clientSecret: merchant.clientSecret,
      }) as IfoodAccessToken;

      const result = await runtime.eventService.processWebhook({
        storeId,
        tenantId: merchant.tenantId ?? null,
        merchant,
        accessToken: authToken.accessToken ?? authToken.access_token,
        rawBody,
        signature,
      });

      await touchIntegrationMerchant({
        storeId,
        merchantId,
        updates: {
          lastWebhookAt: new Date().toISOString(),
          lastSyncAt: new Date().toISOString(),
          lastSyncError: null,
        },
      });

      response.json({
        ok: true,
        data: result,
      });
    } catch (error) {
      request.log?.error({
        context: 'ifood.webhook',
        storeId,
        merchantId,
        error: serializeError(error),
      }, 'Failed to process iFood webhook');
      await touchIntegrationMerchant({
        storeId,
        merchantId,
        updates: {
          lastSyncError: error instanceof Error ? error.message : 'Falha no webhook do iFood.',
        },
      }).catch(() => {});

      response.status(401).json({
        error: error instanceof Error ? error.message : 'Nao foi possivel processar o webhook do iFood.',
      });
    }
  });

  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    const requestLoggerInstance = request.log ?? appLogger;

    if (error instanceof RequestValidationError) {
      requestLoggerInstance.warn({
        context: 'express.validation',
        route: request.originalUrl,
        method: request.method,
        source: error.source,
        details: error.details,
      }, error.message);

      if (!response.headersSent) {
        response.status(error.statusCode).json({
          error: error.message,
          code: error.code,
          source: error.source,
          details: error.details,
        });
      }

      return;
    }

    requestLoggerInstance.error({
      context: 'express.unhandled',
      route: request.originalUrl,
      method: request.method,
      error: serializeError(error),
    }, 'Unhandled backend error');

    if (response.headersSent) {
      return;
    }

    response.status(500).json({
      error: 'Erro interno no servidor.',
    });
  });

  return app;
}

const app = createApp();

export default app;
