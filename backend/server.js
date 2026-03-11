import express from 'express';

import { backendEnv } from './config/env.js';
import { createIfoodFirestoreRepository } from './integrations/ifood/ifoodFirestoreRepository.js';
import { createIfoodIntegrationRuntime } from './integrations/ifood/ifoodIntegrationRuntime.js';
import {
  getIntegrationMerchant,
  listIntegrationMerchants,
  touchIntegrationMerchant,
} from './repositories/integrationMerchantRepository.js';

const app = express();
const repository = createIfoodFirestoreRepository();
const runtime = createIfoodIntegrationRuntime({
  env: backendEnv,
  repositories: repository,
});

app.use('/api', express.json());
app.use('/webhooks/ifood', express.text({ type: '*/*' }));

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'nexus-ifood-integration',
    timestamp: new Date().toISOString(),
  });
});

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

app.listen(backendEnv.port, () => {
  console.log(
    `nexus-ifood backend ativo em http://127.0.0.1:${backendEnv.port} (${backendEnv.nodeEnv})`,
  );
});
