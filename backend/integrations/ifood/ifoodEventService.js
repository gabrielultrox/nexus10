import crypto from 'node:crypto';

import { resolveIfoodEventDescriptor } from './ifoodStatusMapper.js';

function safeJsonParse(rawBody) {
  try {
    return JSON.parse(rawBody);
  } catch (error) {
    return null;
  }
}

function createWebhookSignature(secret, rawBody) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
}

export function createIfoodEventService({
  adapter,
  orderService,
  repositories,
} = {}) {
  if (!adapter || !orderService || !repositories) {
    throw new Error('Adapter, serviço de pedidos e repositórios são obrigatórios para o serviço de eventos do iFood.');
  }

  async function persistEvent({ storeId, tenantId, merchant, event, mode }) {
    const descriptor = resolveIfoodEventDescriptor(event);

    await repositories.upsertEvent({
      storeId,
      tenantId,
      event: {
        id: event.id,
        source: 'ifood',
        merchantId: merchant.merchantId,
        externalOrderId: event.orderId,
        eventCode: event.code ?? '',
        eventFullCode: event.fullCode ?? '',
        eventGroup: descriptor.eventGroup,
        salesChannel: event.salesChannel ?? 'IFOOD',
        metadata: {
          category: event.category ?? null,
          metadata: event.metadata ?? null,
          mode,
        },
        createdAt: event.createdAt ?? new Date().toISOString(),
        processedAt: new Date().toISOString(),
      },
    });
  }

  return {
    verifyWebhookSignature({ rawBody, signature, secret }) {
      if (!secret) {
        throw new Error('webhookSecret é obrigatório para validar a assinatura do iFood.');
      }

      const calculatedSignature = createWebhookSignature(secret, rawBody);
      return crypto.timingSafeEqual(Buffer.from(calculatedSignature), Buffer.from(signature ?? ''));
    },

    async processPolling({ storeId, tenantId, merchant, accessToken }) {
      const pollingResponse = await adapter.pollEvents({ accessToken });
      const events = Array.isArray(pollingResponse) ? pollingResponse : (pollingResponse?.events ?? []);
      const processedIds = [];

      for (const event of events) {
        if (!event?.id || !event?.orderId) {
          continue;
        }

        const alreadyProcessed = await repositories.hasProcessedEvent(storeId, event.id);

        if (alreadyProcessed) {
          await repositories.appendLog({
            storeId,
            tenantId,
            log: {
              source: 'ifood',
              merchantId: merchant.merchantId,
              externalOrderId: event.orderId,
              scope: 'event.duplicate',
              level: 'warning',
              message: `Evento duplicado ${event.id} ignorado.`,
              payload: event,
            },
          });
          processedIds.push(event.id);
          continue;
        }

        await persistEvent({ storeId, tenantId, merchant, event, mode: 'polling' });

        const rawOrder = await adapter.getOrderDetails({
          accessToken,
          orderId: event.orderId,
        });

        await orderService.upsertOrderFromDetails({
          storeId,
          tenantId,
          merchant,
          rawOrder,
          event,
          syncContext: {
            lastEventId: event.id,
            syncedAt: new Date().toISOString(),
          },
        });

        processedIds.push(event.id);
      }

      if (processedIds.length > 0) {
        await adapter.acknowledgeEvents({
          accessToken,
          eventIds: processedIds,
        });
      }

      await repositories.appendLog({
        storeId,
        tenantId,
        log: {
          source: 'ifood',
          merchantId: merchant.merchantId,
          scope: 'polling',
          level: 'info',
          message: `Ciclo de polling concluído com ${processedIds.length} eventos processados.`,
          payload: {
            eventCount: processedIds.length,
            eventIds: processedIds,
          },
        },
      });

      return {
        processedCount: processedIds.length,
        acknowledgedIds: processedIds,
      };
    },

    async processWebhook({
      storeId,
      tenantId,
      merchant,
      accessToken,
      rawBody,
      signature,
    }) {
      const isValid = this.verifyWebhookSignature({
        rawBody,
        signature,
        secret: merchant.webhookSecret,
      });

      if (!isValid) {
        throw new Error('Assinatura do webhook do iFood inválida.');
      }

      const payload = safeJsonParse(rawBody);
      const events = Array.isArray(payload) ? payload : (payload?.events ?? [payload].filter(Boolean));

      for (const event of events) {
        if (!event?.id || !event?.orderId) {
          continue;
        }

        const alreadyProcessed = await repositories.hasProcessedEvent(storeId, event.id);

        if (alreadyProcessed) {
          continue;
        }

        await persistEvent({ storeId, tenantId, merchant, event, mode: 'webhook' });

        const rawOrder = await adapter.getOrderDetails({
          accessToken,
          orderId: event.orderId,
        });

        await orderService.upsertOrderFromDetails({
          storeId,
          tenantId,
          merchant,
          rawOrder,
          event,
          syncContext: {
            lastEventId: event.id,
            syncedAt: new Date().toISOString(),
          },
        });
      }

      await repositories.appendLog({
        storeId,
        tenantId,
        log: {
          source: 'ifood',
          merchantId: merchant.merchantId,
          scope: 'webhook',
          level: 'info',
          message: `Webhook do iFood recebido com ${events.length} eventos.`,
          payload: {
            eventCount: events.length,
          },
        },
      });

      return {
        accepted: true,
        eventCount: events.length,
      };
    },
  };
}
