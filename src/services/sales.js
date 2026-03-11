import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { assertFirebaseReady, firebaseDb } from './firebase';
import { syncSaleToFinancialEntry } from './finance';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';
import { syncSaleInventory } from './inventory';

const saleStatusOptions = ['completed', 'canceled', 'refunded'];
const refundableStatuses = new Set(['completed']);
const cancelableStatuses = new Set(['completed']);

function parseMoney(value, fieldLabel) {
  const normalized = String(value ?? '').replace(/\s+/g, '').replace(',', '.');
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} invalido.`);
  }

  return parsed;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('A venda precisa ter ao menos um item.');
  }

  return items.map((item, index) => {
    const name = item?.name?.trim();
    const quantity = Number(item?.quantity ?? 0);
    const unitPrice = Number(item?.unitPrice ?? 0);

    if (!name) {
      throw new Error(`Item ${index + 1} sem nome.`);
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Quantidade invalida no item ${index + 1}.`);
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Preco invalido no item ${index + 1}.`);
    }

    return {
      id: item.id ?? `item-${index + 1}`,
      productId: item.productId ?? null,
      name,
      quantity,
      unitPrice,
      total: Number((quantity * unitPrice).toFixed(2)),
    };
  });
}

function normalizeCustomerSnapshot(values) {
  if (!values.customerSnapshot || !values.customerSnapshot.name) {
    throw new Error('A venda precisa de um snapshot minimo do cliente.');
  }

  return {
    id: values.customerSnapshot.id ?? values.customerId ?? null,
    name: values.customerSnapshot.name.trim(),
    phone: values.customerSnapshot.phone ?? '',
    neighborhood: values.customerSnapshot.neighborhood ?? '',
  };
}

async function loadOrderSnapshot(storeId, orderId) {
  if (!orderId) {
    return null;
  }

  assertFirebaseReady();
  const orderRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.orders, orderId);
  const orderSnapshot = await getDoc(orderRef);

  if (!orderSnapshot.exists()) {
    throw new Error('Pedido de origem nao encontrado.');
  }

  return {
    id: orderSnapshot.id,
    ...orderSnapshot.data(),
  };
}

function getSalesCollectionRef(storeId) {
  assertFirebaseReady();
  return collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.sales);
}

function mapSnapshot(snapshot) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export function getSaleStatusMeta(status) {
  switch (status) {
    case 'canceled':
      return { label: 'Cancelada', badgeClass: 'ui-badge--danger' };
    case 'refunded':
      return { label: 'Estornada', badgeClass: 'ui-badge--warning' };
    default:
      return { label: 'Concluida', badgeClass: 'ui-badge--success' };
  }
}

export function validateSaleInput(values) {
  if (!values.paymentMethod?.trim()) {
    throw new Error('Informe a forma de pagamento.');
  }

  const status = values.status?.trim() || 'completed';

  if (!saleStatusOptions.includes(status)) {
    throw new Error('Status de venda invalido.');
  }

  const items = normalizeItems(values.items);
  const subtotal = parseMoney(values.subtotal, 'Subtotal');
  const discount = parseMoney(values.discount ?? 0, 'Desconto');
  const shipping = parseMoney(values.shipping ?? 0, 'Frete');
  const total = parseMoney(values.total, 'Total');
  const expectedTotal = Number((subtotal - discount + shipping).toFixed(2));

  if (Math.abs(total - expectedTotal) > 0.01) {
    throw new Error('Total inconsistente com subtotal, desconto e frete.');
  }

  return {
    orderId: values.orderId?.trim() || null,
    customerId: values.customerId?.trim() || null,
    customerSnapshot: normalizeCustomerSnapshot(values),
    items,
    subtotal,
    discount,
    shipping,
    total,
    paymentMethod: values.paymentMethod.trim(),
    status,
  };
}

export function subscribeToSales(storeId, onData, onError) {
  const salesQuery = query(getSalesCollectionRef(storeId), orderBy('createdAt', 'desc'));

  return onSnapshot(
    salesQuery,
    (snapshot) => {
      onData(snapshot.docs.map(mapSnapshot));
    },
    onError,
  );
}

export async function getSaleById({ storeId, saleId }) {
  assertFirebaseReady();
  const saleRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.sales, saleId);
  const snapshot = await getDoc(saleRef);

  if (!snapshot.exists()) {
    return null;
  }

  return mapSnapshot(snapshot);
}

export async function createSale({ storeId, tenantId, values }) {
  const payload = validateSaleInput(values);
  const orderSnapshot = await loadOrderSnapshot(storeId, payload.orderId);

  if (orderSnapshot && payload.customerId && orderSnapshot.customerId && orderSnapshot.customerId !== payload.customerId) {
    throw new Error('Cliente inconsistente com o pedido de origem.');
  }

  const saleRef = await addDoc(getSalesCollectionRef(storeId), {
    ...payload,
    orderSnapshot: orderSnapshot
      ? {
        id: orderSnapshot.id,
        status: orderSnapshot.status ?? '',
        paymentMethod: orderSnapshot.paymentMethod ?? '',
        total: orderSnapshot.total ?? null,
      }
      : null,
    financialReady: true,
    reportingReady: true,
    storeId,
    tenantId: tenantId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const persistedSale = {
    id: saleRef.id,
    ...payload,
    tenantId: tenantId ?? null,
    createdAt: new Date().toISOString(),
  };

  try {
    await syncSaleInventory({
      storeId,
      tenantId,
      sale: persistedSale,
      previousStatus: null,
    });

    await syncSaleToFinancialEntry({
      storeId,
      tenantId,
      sale: persistedSale,
    });
  } catch (error) {
    await deleteDoc(saleRef);
    throw error;
  }
}

export async function updateSaleStatus({ storeId, saleId, status }) {
  assertFirebaseReady();

  if (!saleStatusOptions.includes(status)) {
    throw new Error('Status de venda invalido.');
  }

  const saleRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.sales, saleId);
  const snapshot = await getDoc(saleRef);

  if (!snapshot.exists()) {
    throw new Error('Venda nao encontrada.');
  }

  const currentSale = snapshot.data();
  const currentStatus = currentSale.status ?? 'completed';

  if (status === 'canceled' && !cancelableStatuses.has(currentStatus)) {
    throw new Error('Esta venda nao pode mais ser cancelada.');
  }

  if (status === 'refunded' && !refundableStatuses.has(currentStatus)) {
    throw new Error('Esta venda nao pode ser estornada.');
  }

  await updateDoc(saleRef, {
    status,
    updatedAt: serverTimestamp(),
  });

  await syncSaleInventory({
    storeId,
    tenantId: currentSale.tenantId ?? null,
    sale: {
      id: saleId,
      ...currentSale,
      status,
    },
    previousStatus: currentStatus,
  });

  await syncSaleToFinancialEntry({
    storeId,
    tenantId: currentSale.tenantId ?? null,
    sale: {
      id: saleId,
      ...currentSale,
      status,
    },
  });
}

export async function linkSaleToOrder({ storeId, saleId, orderId }) {
  const orderSnapshot = await loadOrderSnapshot(storeId, orderId);
  assertFirebaseReady();

  const saleRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.sales, saleId);
  await updateDoc(saleRef, {
    orderId: orderSnapshot.id,
    orderSnapshot: {
      id: orderSnapshot.id,
      status: orderSnapshot.status ?? '',
      paymentMethod: orderSnapshot.paymentMethod ?? '',
      total: orderSnapshot.total ?? null,
    },
    updatedAt: serverTimestamp(),
  });
}
