import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { requestBackend } from './backendApi';
import { assertFirebaseReady, canUseRemoteSync, createRemoteSyncError, firebaseDb, guardRemoteSubscription } from './firebase';
import { subscribeToExternalOrders } from './externalOrders';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';
import {
  formatCurrencyBRL,
  getChannelLabel,
  getPaymentMethodLabel,
  mapOrderDomainStatusToLegacyBoardStatus,
  normalizeChannel,
  normalizeOrderDomainStatus,
  normalizeOrderSaleStatus,
  normalizePaymentMethod,
} from './commerce';

const orderStatusSequence = ['received', 'preparing', 'out_for_delivery', 'delivered'];

function asDate(value) {
  if (!value) {
    return null;
  }

  return typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
}

function parseMoney(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTime(value) {
  const dateValue = asDate(value);

  if (!dateValue) {
    return '--:--';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateValue);
}

function formatDateTime(value) {
  const dateValue = asDate(value);

  if (!dateValue) {
    return 'Sem data';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateValue);
}

function formatWaitTime(value) {
  const dateValue = asDate(value);

  if (!dateValue) {
    return '--';
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - dateValue.getTime()) / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min`;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function normalizePriority(rawOrder, createdAt) {
  const rawPriority = String(rawOrder.priority ?? '').trim().toLowerCase();

  if (rawPriority === 'high' || rawPriority === 'urgent') {
    return 'high';
  }

  if (!createdAt) {
    return 'normal';
  }

  return (Date.now() - createdAt.getTime()) / 60000 >= 35 ? 'high' : 'normal';
}

function buildItemsSummary(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'Itens nao informados';
  }

  const summary = items
    .slice(0, 3)
    .map((item) => {
      const quantity = Number(item?.quantity ?? 0);
      const name = item?.productSnapshot?.name?.trim() || item?.name?.trim() || 'Item';
      return quantity > 0 ? `${quantity}x ${name}` : name;
    })
    .join(' | ');

  return items.length > 3 ? `${summary} +${items.length - 3}` : summary;
}

function mergeOrdersBySource(internalOrders, externalOrders) {
  return [...internalOrders, ...externalOrders].sort((left, right) => {
    const leftDate = left.updatedAt?.getTime?.() ?? left.createdAt?.getTime?.() ?? 0;
    const rightDate = right.updatedAt?.getTime?.() ?? right.createdAt?.getTime?.() ?? 0;
    return rightDate - leftDate;
  });
}

function getOrdersCollectionRef(storeId) {
  assertFirebaseReady();
  return collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.orders);
}

function normalizeOrderRecord(id, data, { isExternal = false } = {}) {
  const createdAt = asDate(data.createdAt);
  const updatedAt = asDate(data.updatedAt) ?? createdAt;
  const domainStatus = normalizeOrderDomainStatus(data.status);
  const status = mapOrderDomainStatusToLegacyBoardStatus(domainStatus);
  const saleStatus = normalizeOrderSaleStatus(data.saleStatus, data.saleId ? 'LAUNCHED' : 'NOT_LAUNCHED');
  const channel = normalizeChannel(data.source ?? data.origin, isExternal ? 'IFOOD' : null);
  const paymentMethod = normalizePaymentMethod(
    data.paymentPreview?.method ?? data.paymentMethod ?? data.payment?.method,
    null,
  );
  const totalAmount = parseMoney(data.totals?.total ?? data.total);
  const customerName = data.customerSnapshot?.name?.trim() || data.customerName?.trim() || 'Cliente';
  const neighborhood = data.address?.neighborhood?.trim()
    || data.customerSnapshot?.neighborhood?.trim()
    || data.neighborhood?.trim()
    || 'Bairro nao informado';
  const courierName = data.courierSnapshot?.name?.trim()
    || data.courierName?.trim()
    || data.assignedCourierName?.trim()
    || 'Nao atribuido';

  return {
    id,
    ...data,
    status,
    domainStatus,
    saleStatus,
    sourceChannel: channel,
    source: channel ? getChannelLabel(channel) : (isExternal ? 'iFood' : 'Nao informado'),
    origin: channel ? getChannelLabel(channel) : (data.origin ?? 'Nao informado'),
    paymentMethod,
    paymentMethodLabel: paymentMethod ? getPaymentMethodLabel(paymentMethod) : 'Nao informado',
    priority: normalizePriority(data, createdAt),
    number: data.code?.trim() || data.number?.trim() || `#${id.slice(0, 6).toUpperCase()}`,
    customerName,
    neighborhood,
    courierName,
    itemsSummary: buildItemsSummary(data.items),
    totalAmount,
    total: formatCurrencyBRL(totalAmount),
    time: formatTime(createdAt),
    waitTime: formatWaitTime(createdAt),
    createdAt,
    createdAtLabel: formatDateTime(createdAt),
    updatedAt,
    updatedAtLabel: formatDateTime(updatedAt),
    isExternal,
    timeline: Array.isArray(data.timeline) ? data.timeline : [],
    tracking: Array.isArray(data.tracking) ? data.tracking : [],
    externalStatus: data.externalStatus ?? null,
    normalizedStatus: status,
    syncErrorMessage: data.sync?.lastSyncError ?? null,
  };
}

function normalizeOrder(documentSnapshot) {
  return normalizeOrderRecord(documentSnapshot.id, documentSnapshot.data());
}

function normalizeExternalOrder(order) {
  const channel = normalizeChannel(order.source ?? 'IFOOD', 'IFOOD');
  const paymentMethod = normalizePaymentMethod(order.paymentMethod, null);

  return normalizeOrderRecord(order.id, {
    ...order,
    source: channel,
    paymentMethod,
    customerSnapshot: {
      id: order.customer?.id ?? null,
      name: order.customer?.name ?? 'Cliente iFood',
      neighborhood: order.customer?.address?.neighborhood ?? '',
      phone: order.customer?.phone ?? '',
    },
    address: {
      neighborhood: order.customer?.address?.neighborhood ?? '',
      addressLine: order.customer?.address?.streetName ?? '',
      reference: order.customer?.address?.reference ?? '',
      complement: order.customer?.address?.complement ?? '',
    },
    totals: {
      subtotal: parseMoney(order.subtotal),
      freight: parseMoney(order.shipping),
      extraAmount: 0,
      discountPercent: 0,
      discountValue: parseMoney(order.discount),
      total: parseMoney(order.total),
    },
  }, { isExternal: true });
}

export function subscribeToOrders(storeId, onData, onError) {
  if (!storeId || !canUseRemoteSync()) {
    onData([]);
    return () => {};
  }

  const ordersQuery = query(getOrdersCollectionRef(storeId), orderBy('createdAt', 'desc'));
  let internalOrders = [];
  let externalOrders = [];

  function emitMergedOrders() {
    onData(mergeOrdersBySource(internalOrders, externalOrders));
  }

  const unsubscribeInternal = guardRemoteSubscription(
    () => onSnapshot(
      ordersQuery,
      (snapshot) => {
        internalOrders = snapshot.docs.map(normalizeOrder);
        emitMergedOrders();
      },
      onError,
    ),
    {
      onFallback() {
        internalOrders = [];
        externalOrders = [];
        emitMergedOrders();
      },
      onError,
    },
  );

  const unsubscribeExternal = subscribeToExternalOrders(
    storeId,
    (orders) => {
      externalOrders = orders.map(normalizeExternalOrder);
      emitMergedOrders();
    },
    onError,
  );

  return () => {
    unsubscribeInternal?.();
    unsubscribeExternal?.();
  };
}

export function getNextOrderStatus(currentStatus) {
  const currentIndex = orderStatusSequence.indexOf(currentStatus);

  if (currentIndex === -1 || currentIndex === orderStatusSequence.length - 1) {
    return null;
  }

  return orderStatusSequence[currentIndex + 1];
}

export async function getOrderById({ storeId, orderId }) {
  if (!canUseRemoteSync()) {
    throw createRemoteSyncError();
  }

  assertFirebaseReady();

  const orderRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.orders, orderId);
  const snapshot = await getDoc(orderRef);

  if (!snapshot.exists()) {
    return null;
  }

  return normalizeOrder(snapshot);
}

export async function createOrder({ storeId, tenantId, values, createdBy = null }) {
  const data = await requestBackend(`/stores/${storeId}/orders`, {
    method: 'POST',
    body: {
      tenantId: tenantId ?? null,
      values,
      createdBy,
    },
  });

  return data.id;
}

export async function updateOrder({ storeId, orderId, values }) {
  const data = await requestBackend(`/stores/${storeId}/orders/${orderId}`, {
    method: 'PATCH',
    body: {
      values,
    },
  });

  return data.id;
}

export async function markOrderAsDispatched({ storeId, orderId }) {
  await requestBackend(`/stores/${storeId}/orders/${orderId}/dispatch`, {
    method: 'POST',
  });
}

export async function convertOrderToSale({
  storeId,
  tenantId,
  orderId,
  values = {},
  createdBy = null,
}) {
  const data = await requestBackend(`/stores/${storeId}/orders/${orderId}/convert-to-sale`, {
    method: 'POST',
    body: {
      tenantId: tenantId ?? null,
      values,
      createdBy,
    },
  });

  return data.saleId;
}

export async function updateOrderStatus({ storeId, orderId, status }) {
  const allowedStatuses = new Set([...orderStatusSequence, 'cancelled', 'OPEN', 'DISPATCHED', 'CONVERTED_TO_SALE', 'CANCELLED']);

  if (!allowedStatuses.has(status)) {
    throw new Error('Status de pedido invalido.');
  }

  if (!canUseRemoteSync()) {
    throw createRemoteSyncError();
  }

  assertFirebaseReady();
  const orderRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.orders, orderId);

  await updateDoc(orderRef, {
    status,
    updatedAt: serverTimestamp(),
  });
}
