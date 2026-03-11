import { createSaleFromOrder } from '../sales/saleService.js';
import { mapOrderResponse } from './orderMapper.js';
import { createOrderRepository } from './orderRepository.js';
import {
  buildCreatedBy,
  validateOrderInput,
  validateStoreId,
  createOrderError,
} from './orderValidationService.js';

const repository = createOrderRepository();

function validateOrderId(orderId) {
  if (!String(orderId ?? '').trim()) {
    throw createOrderError('orderId e obrigatorio.');
  }
}

export async function createOrder({ storeId, tenantId = null, values, createdBy = null }) {
  validateStoreId(storeId);
  const payload = validateOrderInput(values);
  const order = await repository.createOrder({
    storeId,
    tenantId,
    payload: {
      ...payload,
      createdBy: buildCreatedBy(createdBy),
    },
  });

  return mapOrderResponse(order);
}

export async function updateOrder({ storeId, orderId, values }) {
  validateStoreId(storeId);
  validateOrderId(orderId);
  const payload = validateOrderInput(values);
  const order = await repository.updateOrder({
    storeId,
    orderId,
    payload,
  });

  return mapOrderResponse(order);
}

export async function markOrderAsDispatched({ storeId, orderId }) {
  validateStoreId(storeId);
  validateOrderId(orderId);
  const order = await repository.markOrderAsDispatched({
    storeId,
    orderId,
  });

  return mapOrderResponse(order);
}

export async function convertOrderToSale({
  storeId,
  tenantId = null,
  orderId,
  values = {},
  createdBy = null,
}) {
  validateStoreId(storeId);
  validateOrderId(orderId);
  return createSaleFromOrder({
    storeId,
    tenantId,
    orderId,
    values,
    createdBy,
  });
}
