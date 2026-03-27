import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { backendEnv } from './config/env.js';
import { logger, serializeError } from './logging/logger.js';
import { registerAuthRoutes } from './modules/auth/authController.js';
import { createIfoodFirestoreRepository } from './integrations/ifood/ifoodFirestoreRepository.js';
import { createIfoodIntegrationRuntime } from './integrations/ifood/ifoodIntegrationRuntime.js';
import { requireApiAuth, requireStoreAccess } from './middleware/requireAuth.js';
import { requestLogger } from './middleware/requestLogger.js';
import { registerAssistantRoutes } from './modules/assistant/assistantController.js';
import { registerOrderRoutes } from './modules/orders/orderController.js';
import { registerSaleRoutes } from './modules/sales/saleController.js';
import {
  getIntegrationMerchant,
  listIntegrationMerchants,
  touchIntegrationMerchant,
} from './repositories/integrationMerchantRepository.js';

function isDevelopmentEnvironment() {
  return backendEnv.nodeEnv !== 'production';
}

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (backendEnv.frontendOrigin.includes(origin)) {
    return true;
  }

  if (isDevelopmentEnvironment()) {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  }

  return false;
}

function createApiRateLimiter(max) {
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

export function createApp() {
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
    crossOriginResourcePolicy: false,
  }));

  app.use((request, response, next) => {
    const origin = request.headers.origin;

    if (!origin) {
      next();
      return;
    }

    if (!isAllowedOrigin(origin)) {
      response.status(403).json({
        error: 'Origem nao autorizada para esta API.',
      });
      return;
    }

    response.header('Access-Control-Allow-Origin', origin);
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

  app.get('/api/health', (_request, response) => {
    response.json({
      status: 'ok',
      service: 'nexus-ifood-integration',
      timestamp: new Date().toISOString(),
    });
  });

  registerAuthRoutes(app);
  app.use('/api', requireApiAuth);
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
        error: error.message ?? 'Nao foi possivel listar os merchants do iFood.',
      });
    }
  });

  app.post('/api/integrations/ifood/polling/run', async (request, response) => {
    const { storeId, merchantId } = request.body ?? {};

    if (!storeId || !merchantId) {
      response.status(400).json({
        error: 'storeId e merchantId sao obrigatorios.',
      });
      return;
    }

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
      });

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
          lastSyncError: error.message ?? 'Falha no polling do iFood.',
        },
      }).catch(() => {});

      response.status(500).json({
        error: error.message ?? 'Nao foi possivel executar o polling do iFood.',
      });
    }
  });

  app.post('/api/integrations/ifood/orders/:storeId/:merchantId/:orderId/sync', async (request, response) => {
    const { storeId, merchantId, orderId } = request.params;

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
      });
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
        error: error.message ?? 'Nao foi possivel sincronizar o pedido do iFood.',
      });
    }
  });

  app.post('/webhooks/ifood/:storeId/:merchantId', async (request, response) => {
    const { storeId, merchantId } = request.params;
    const signature = request.header('X-IFood-Signature');
    const rawBody = request.body ?? '';

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
      });

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
          lastSyncError: error.message ?? 'Falha no webhook do iFood.',
        },
      }).catch(() => {});

      response.status(401).json({
        error: error.message ?? 'Nao foi possivel processar o webhook do iFood.',
      });
    }
  });

  app.use((error, request, response, _next) => {
    const requestLoggerInstance = request.log ?? appLogger;

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
