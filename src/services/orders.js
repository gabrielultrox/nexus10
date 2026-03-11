import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { assertFirebaseReady, firebaseDb } from './firebase';
import { subscribeToExternalOrders } from './externalOrders';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';

const orderStatusSequence = ['received', 'preparing', 'out_for_delivery', 'delivered'];
const orderStatusAliases = {
  new: 'received',
  created: 'received',
  confirmed: 'received',
  pending: 'received',
  queued: 'received',
  received: 'received',
  preparing: 'preparing',
  in_preparation: 'preparing',
  in_progress: 'preparing',
  production: 'preparing',
  out: 'out_for_delivery',
  dispatching: 'out_for_delivery',
  on_route: 'out_for_delivery',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  completed: 'delivered',
  cancelled: 'cancelled',
  cancel: 'cancelled',
};

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

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(parseMoney(value));
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

function normalizeStatus(status) {
  const normalized = String(status ?? '').trim().toLowerCase();
  return orderStatusAliases[normalized] ?? normalized ?? 'received';
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
      const name = item?.name?.trim() || 'Item';
      return quantity > 0 ? `${quantity}x ${name}` : name;
    })
    .join(' · ');

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

function normalizeOrder(documentSnapshot) {
  const data = documentSnapshot.data();
  const createdAt = asDate(data.createdAt);
  const updatedAt = asDate(data.updatedAt);
  const status = normalizeStatus(data.status);
  const total = parseMoney(data.total);
  const customerName = data.customerSnapshot?.name?.trim() || data.customerName?.trim() || 'Cliente';
  const neighborhood = data.customerSnapshot?.neighborhood?.trim() || data.neighborhood?.trim() || 'Bairro nao informado';
  const courierName = data.courierSnapshot?.name?.trim()
    || data.courierName?.trim()
    || data.assignedCourierName?.trim()
    || 'Nao atribuido';

  return {
    id: documentSnapshot.id,
    ...data,
    status,
    priority: normalizePriority(data, createdAt),
    number: data.number?.trim() || `#${documentSnapshot.id.slice(0, 6).toUpperCase()}`,
    customerName,
    neighborhood,
    courierName,
    itemsSummary: buildItemsSummary(data.items),
    totalAmount: total,
    total: formatCurrency(total),
    time: formatTime(createdAt),
    waitTime: formatWaitTime(createdAt),
    createdAt,
    createdAtLabel: formatDateTime(createdAt),
    updatedAt: updatedAt ?? createdAt,
    updatedAtLabel: formatDateTime(updatedAt ?? createdAt),
    isExternal: false,
    source: 'internal',
    timeline: Array.isArray(data.timeline) ? data.timeline : [],
    tracking: Array.isArray(data.tracking) ? data.tracking : [],
    externalStatus: null,
    normalizedStatus: status,
    syncErrorMessage: null,
  };
}

function normalizeExternalOrder(order) {
  const createdAt = asDate(order.createdAt);
  const updatedAt = asDate(order.updatedAt) ?? createdAt;
  const status = normalizeStatus(order.normalizedStatus);
  const customerName = order.customer?.name?.trim() || 'Cliente iFood';
  const neighborhood = order.customer?.address?.neighborhood?.trim() || 'Bairro nao informado';
  const items = Array.isArray(order.items) ? order.items : [];
  const total = parseMoney(order.total);
  const tracking = Array.isArray(order.tracking) ? order.tracking : [];
  const timeline = Array.isArray(order.timeline) ? order.timeline : [];
  const latestTracking = tracking[0] ?? null;

  return {
    id: order.id,
    source: 'iFood',
    status,
    normalizedStatus: status,
    externalStatus: order.externalStatus ?? '',
    priority: normalizePriority(order, createdAt),
    number: order.displayId?.trim() || `#${String(order.externalOrderId ?? order.id).slice(0, 6).toUpperCase()}`,
    customerName,
    neighborhood,
    courierName: latestTracking?.label ?? 'Tracking iFood',
    itemsSummary: buildItemsSummary(items),
    totalAmount: total,
    total: formatCurrency(total),
    time: formatTime(createdAt),
    waitTime: formatWaitTime(createdAt),
    createdAt,
    createdAtLabel: formatDateTime(createdAt),
    updatedAt,
    updatedAtLabel: formatDateTime(updatedAt),
    paymentMethod: order.paymentMethod || 'Nao informado',
    origin: 'iFood',
    isExternal: true,
    externalOrderId: order.externalOrderId,
    merchantId: order.merchantId,
    customer: order.customer,
    items,
    subtotal: parseMoney(order.subtotal),
    discount: parseMoney(order.discount),
    shipping: parseMoney(order.shipping),
    tracking,
    timeline,
    syncErrorMessage: order.sync?.lastSyncError ?? null,
  };
}

export function subscribeToOrders(storeId, onData, onError) {
  const ordersQuery = query(getOrdersCollectionRef(storeId), orderBy('createdAt', 'desc'));
  let internalOrders = [];
  let externalOrders = [];

  function emitMergedOrders() {
    onData(mergeOrdersBySource(internalOrders, externalOrders));
  }

  const unsubscribeInternal = onSnapshot(
    ordersQuery,
    (snapshot) => {
      internalOrders = snapshot.docs.map(normalizeOrder);
      emitMergedOrders();
    },
    onError,
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

export async function updateOrderStatus({ storeId, orderId, status }) {
  assertFirebaseReady();

  if (!orderStatusSequence.includes(status)) {
    throw new Error('Status de pedido invalido.');
  }

  const orderRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.orders, orderId);

  await updateDoc(orderRef, {
    status,
    updatedAt: serverTimestamp(),
  });
}
