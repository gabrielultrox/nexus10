import { normalizeOrderStatus } from '../orders/orderValidationService.js';
import { createSaleRepository } from './saleRepository.js';
import { postSaleLifecycle } from './salePostingService.js';
import {
  buildCreatedBy,
  createSaleError,
  normalizeSaleDomainStatus,
  validateSaleInput,
} from './saleValidationService.js';

const repository = createSaleRepository();
const reversibleStatuses = new Set(['POSTED']);
const saleInfrastructureTimeoutMs = 15000;

function validateStoreId(storeId) {
  if (!String(storeId ?? '').trim()) {
    throw createSaleError('storeId e obrigatorio.');
  }
}

function validateSaleId(saleId) {
  if (!String(saleId ?? '').trim()) {
    throw createSaleError('saleId e obrigatorio.');
  }
}

function validateOrderId(orderId) {
  if (!String(orderId ?? '').trim()) {
    throw createSaleError('orderId e obrigatorio.');
  }
}

function serializeDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function mapSaleResponse(snapshot) {
  if (!snapshot) {
    return null;
  }

  const { id, data } = snapshot;

  return {
    id,
    ...data,
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt),
    launchedAt: serializeDate(data.launchedAt),
  };
}

function buildOrderSnapshot(orderId, order) {
  return {
    id: orderId,
    code: order.code ?? '',
    status: normalizeOrderStatus(order.status, 'OPEN'),
    domainStatus: normalizeOrderStatus(order.status, 'OPEN'),
    total: order.totals?.total ?? 0,
  };
}

function withInfrastructureTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(createSaleError(
          `Tempo excedido ao concluir ${label}.`,
          504,
          'SALE_TIMEOUT',
        ));
      }, saleInfrastructureTimeoutMs);
    }),
  ]);
}

function normalizeInfrastructureError(error) {
  if (error?.code === 'SALE_TIMEOUT') {
    return error;
  }

  const message = String(error?.message ?? '');

  if (/RESOURCE_EXHAUSTED|Quota exceeded/i.test(message)) {
    return createSaleError(
      'Sistema temporariamente sobrecarregado para lancar a venda. Tente novamente em instantes.',
      503,
      'SALE_INFRA_UNAVAILABLE',
    );
  }

  if (/DEADLINE_EXCEEDED|deadline exceeded/i.test(message)) {
    return createSaleError(
      'Tempo excedido ao lancar a venda. Tente novamente em instantes.',
      504,
      'SALE_INFRA_TIMEOUT',
    );
  }

  return error;
}

function isRecoverablePostingError(error) {
  return ['SALE_TIMEOUT', 'SALE_INFRA_TIMEOUT', 'SALE_INFRA_UNAVAILABLE'].includes(error?.code)
    || /Tempo excedido ao concluir o posting da venda/i.test(String(error?.message ?? ''));
}

function buildSaleDocument({
  storeId,
  tenantId,
  validatedSale,
  createdBy,
  orderSnapshot = null,
}) {
  const actor = buildCreatedBy(createdBy);
  const now = new Date();

  return {
    ...validatedSale,
    storeId,
    tenantId: tenantId ?? null,
    orderSnapshot,
    stockPosted: false,
    financialPosted: false,
    createdBy: actor,
    launchedAt: now,
    launchedBy: actor,
    createdAt: now,
    updatedAt: now,
  };
}

function mergeOrderIntoSaleValues(order, values = {}, orderId) {
  const paymentMethod = values.payment?.method
    ?? values.paymentMethod
    ?? order.paymentPreview?.method
    ?? order.payment?.method
    ?? null;

  return {
    code: values.code ?? undefined,
    orderId,
    source: 'ORDER',
    channel: values.channel ?? values.source ?? order.source ?? order.channel ?? null,
    customerId: values.customerId ?? order.customerId ?? order.customerSnapshot?.id ?? null,
    customerSnapshot: values.customerSnapshot ?? order.customerSnapshot ?? undefined,
    items: Array.isArray(values.items) && values.items.length > 0 ? values.items : order.items,
    totals: values.totals ?? order.totals,
    paymentMethod,
    payment: values.payment,
    address: values.address ?? order.address,
    notes: values.notes ?? order.notes ?? '',
    status: 'POSTED',
  };
}

async function finalizeSaleCreation({
  storeId,
  tenantId,
  saleId,
  saleData,
  actor,
}) {
  try {
    const postingFlags = await withInfrastructureTimeout(
      postSaleLifecycle({
        storeId,
        tenantId,
        sale: {
          id: saleId,
          ...saleData,
        },
        previousStatus: null,
        actor,
      }),
      'o posting da venda',
    );

    const nextData = {
      ...saleData,
      ...postingFlags,
      updatedAt: new Date(),
    };

    await withInfrastructureTimeout(
      repository.markPostingFlags({
        storeId,
        saleId,
        stockPosted: postingFlags.stockPosted,
        financialPosted: postingFlags.financialPosted,
      }),
      'a confirmacao do posting',
    );

    return {
      id: saleId,
      data: nextData,
    };
  } catch (error) {
    throw normalizeInfrastructureError(error);
  }
}

async function safeCleanup(task) {
  await withInfrastructureTimeout(task, 'a limpeza da operacao').catch(() => {});
}

export async function createDirectSale({ storeId, tenantId = null, values, createdBy = null }) {
  validateStoreId(storeId);

  const validatedSale = validateSaleInput({
    ...values,
    source: 'DIRECT',
    status: 'POSTED',
  });
  const saleData = buildSaleDocument({
    storeId,
    tenantId,
    validatedSale,
    createdBy,
  });

  const createdSale = await withInfrastructureTimeout(
    repository.createDirectSale({
      storeId,
      payload: saleData,
    }),
    'a criacao inicial da venda',
  );

  try {
    const persistedSale = await finalizeSaleCreation({
      storeId,
      tenantId,
      saleId: createdSale.id,
      saleData,
      actor: buildCreatedBy(createdBy),
    });

    return mapSaleResponse(persistedSale);
  } catch (error) {
    if (isRecoverablePostingError(error)) {
      return mapSaleResponse(createdSale);
    }

    await safeCleanup(
      repository.deleteSale({
        storeId,
        saleId: createdSale.id,
      }),
    );

    throw error;
  }
}

export async function createSaleFromOrder({
  storeId,
  tenantId = null,
  orderId,
  values = {},
  createdBy = null,
}) {
  validateStoreId(storeId);
  validateOrderId(orderId);

  const order = await repository.getOrderById({ storeId, orderId });

  if (!order) {
    throw createSaleError('Pedido nao encontrado.', 404, 'ORDER_NOT_FOUND');
  }

  if (normalizeOrderStatus(order.data.status, 'OPEN') === 'CANCELLED') {
    throw createSaleError('Pedidos cancelados nao podem gerar venda.', 409, 'ORDER_CANCELLED');
  }

  const validatedSale = validateSaleInput(mergeOrderIntoSaleValues(order.data, values, orderId));
  const saleData = buildSaleDocument({
    storeId,
    tenantId: tenantId ?? order.data.tenantId ?? null,
    validatedSale,
    createdBy,
    orderSnapshot: buildOrderSnapshot(orderId, order.data),
  });

  const createdSale = await withInfrastructureTimeout(
    repository.createSaleFromOrder({
      storeId,
      orderId,
      payload: saleData,
    }),
    'a criacao inicial da venda a partir do pedido',
  );

  try {
    const persistedSale = await finalizeSaleCreation({
      storeId,
      tenantId: saleData.tenantId ?? null,
      saleId: createdSale.saleId,
      saleData,
      actor: buildCreatedBy(createdBy),
    });

    return {
      orderId,
      saleId: createdSale.saleId,
      sale: mapSaleResponse(persistedSale),
    };
  } catch (error) {
    if (isRecoverablePostingError(error)) {
      return {
        orderId,
        saleId: createdSale.saleId,
        sale: mapSaleResponse({
          id: createdSale.saleId,
          data: saleData,
        }),
      };
    }

    await safeCleanup(
      repository.revertSaleFromOrder({
        storeId,
        orderId,
        saleId: createdSale.saleId,
        previousOrderStatus: createdSale.previousOrderStatus,
      }),
    );

    throw error;
  }
}

export async function deleteSale({ storeId, saleId }) {
  validateStoreId(storeId);
  validateSaleId(saleId);

  const deletedSale = await repository.deleteSaleRecord({
    storeId,
    saleId,
  });

  return mapSaleResponse(deletedSale);
}

export async function updateSaleStatus({ storeId, saleId, status, actor = null }) {
  validateStoreId(storeId);
  validateSaleId(saleId);

  const currentSale = await repository.getSaleById({ storeId, saleId });

  if (!currentSale) {
    throw createSaleError('Venda nao encontrada.', 404, 'SALE_NOT_FOUND');
  }

  const nextStatus = normalizeSaleDomainStatus(status, null);

  if (!nextStatus) {
    throw createSaleError('Status de venda invalido.');
  }

  const currentStatus = normalizeSaleDomainStatus(currentSale.data.status, 'POSTED');

  if (nextStatus === currentStatus) {
    return mapSaleResponse(currentSale);
  }

  if (!reversibleStatuses.has(currentStatus)) {
    throw createSaleError('Esta venda nao pode mais ser alterada.', 409, 'SALE_ALREADY_CLOSED');
  }

  if (nextStatus === 'POSTED') {
    throw createSaleError('A venda ja foi lancada e nao pode voltar para POSTED.', 409, 'SALE_STATUS_INVALID');
  }

  const updatedSale = await repository.updateSaleStatus({
    storeId,
    saleId,
    status: nextStatus,
  });

  const postingFlags = await postSaleLifecycle({
    storeId,
    tenantId: updatedSale.data.tenantId ?? null,
    sale: {
      id: saleId,
      ...updatedSale.data,
    },
    previousStatus: updatedSale.previousStatus,
    actor: buildCreatedBy(actor),
  });

  await repository.markPostingFlags({
    storeId,
    saleId,
    stockPosted: postingFlags.stockPosted,
    financialPosted: postingFlags.financialPosted,
  });

  return mapSaleResponse({
    id: saleId,
    data: {
      ...updatedSale.data,
      ...postingFlags,
      updatedAt: new Date(),
    },
  });
}
