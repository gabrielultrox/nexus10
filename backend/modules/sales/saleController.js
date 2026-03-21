import {
  createDirectSale,
  deleteSale,
  createSaleFromOrder,
  updateSaleStatus,
} from './saleService.js';

function getPayload(body) {
  return body?.values ?? body ?? {};
}

function sendError(response, error, fallbackMessage) {
  response.status(error.statusCode ?? 500).json({
    error: error.message ?? fallbackMessage,
  });
}

export function registerSaleRoutes(app) {
  app.post('/api/stores/:storeId/sales', async (request, response) => {
    try {
      const data = await createDirectSale({
        storeId: request.params.storeId,
        tenantId: request.body?.tenantId ?? null,
        values: getPayload(request.body),
        createdBy: request.body?.createdBy ?? null,
      });

      response.status(201).json({ data });
    } catch (error) {
      sendError(response, error, 'Nao foi possivel criar a venda.');
    }
  });

  app.post('/api/stores/:storeId/orders/:orderId/sales', async (request, response) => {
    try {
      const data = await createSaleFromOrder({
        storeId: request.params.storeId,
        tenantId: request.body?.tenantId ?? null,
        orderId: request.params.orderId,
        values: getPayload(request.body),
        createdBy: request.body?.createdBy ?? null,
      });

      response.status(201).json({ data });
    } catch (error) {
      sendError(response, error, 'Nao foi possivel gerar a venda a partir do pedido.');
    }
  });

  app.patch('/api/stores/:storeId/sales/:saleId/status', async (request, response) => {
    try {
      const data = await updateSaleStatus({
        storeId: request.params.storeId,
        saleId: request.params.saleId,
        status: request.body?.status,
        actor: request.body?.createdBy ?? request.body?.actor ?? null,
      });

      response.json({ data });
    } catch (error) {
      sendError(response, error, 'Nao foi possivel atualizar o status da venda.');
    }
  });

  app.delete('/api/stores/:storeId/sales/:saleId', async (request, response) => {
    try {
      const data = await deleteSale({
        storeId: request.params.storeId,
        saleId: request.params.saleId,
      });

      response.json({ data });
    } catch (error) {
      sendError(response, error, 'Nao foi possivel excluir a venda.');
    }
  });
}
