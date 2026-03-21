import {
  convertOrderToSale,
  createOrder,
  deleteOrder,
  markOrderAsDispatched,
  updateOrder,
} from './orderService.js';

function getPayload(body) {
  return body?.values ?? body ?? {};
}

function sendError(response, error, fallbackMessage) {
  response.status(error.statusCode ?? 500).json({
    error: error.message ?? fallbackMessage,
  });
}

export function registerOrderRoutes(app) {
  app.post('/api/stores/:storeId/orders', async (request, response) => {
    try {
      const data = await createOrder({
        storeId: request.params.storeId,
        tenantId: request.body?.tenantId ?? null,
        values: getPayload(request.body),
        createdBy: request.body?.createdBy ?? null,
      });

      response.status(201).json({ data });
    } catch (error) {
      sendError(response, error, 'Nao foi possivel criar o pedido.');
    }
  });

  app.patch('/api/stores/:storeId/orders/:orderId', async (request, response) => {
    try {
      const data = await updateOrder({
        storeId: request.params.storeId,
        orderId: request.params.orderId,
        values: getPayload(request.body),
      });

      response.json({ data });
    } catch (error) {
      sendError(response, error, 'Nao foi possivel atualizar o pedido.');
    }
  });

  app.post('/api/stores/:storeId/orders/:orderId/dispatch', async (request, response) => {
    try {
      const data = await markOrderAsDispatched({
        storeId: request.params.storeId,
        orderId: request.params.orderId,
      });

      response.json({ data });
    } catch (error) {
      sendError(response, error, 'Nao foi possivel marcar o pedido como despachado.');
    }
  });

  app.post('/api/stores/:storeId/orders/:orderId/convert-to-sale', async (request, response) => {
    try {
      const data = await convertOrderToSale({
        storeId: request.params.storeId,
        tenantId: request.body?.tenantId ?? null,
        orderId: request.params.orderId,
        values: getPayload(request.body),
        createdBy: request.body?.createdBy ?? null,
      });

      response.json({ data });
    } catch (error) {
      sendError(response, error, 'Nao foi possivel gerar a venda a partir do pedido.');
    }
  });

  app.delete('/api/stores/:storeId/orders/:orderId', async (request, response) => {
    try {
      const data = await deleteOrder({
        storeId: request.params.storeId,
        orderId: request.params.orderId,
      });

      response.json({ data });
    } catch (error) {
      sendError(response, error, 'Nao foi possivel excluir o pedido.');
    }
  });
}
