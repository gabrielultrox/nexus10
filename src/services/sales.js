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
import {
  getChannelLabel,
  getPaymentMethodLabel,
  isSalePosted,
  mapSaleDomainStatusToLegacyStatus,
  normalizeChannel,
  normalizeOrderDomainStatus,
  normalizePaymentMethod,
  normalizeSaleDomainStatus,
  normalizeSaleSource,
} from './commerce';
import { syncSaleToFinancialEntry } from './finance';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';
import { syncSaleInventory } from './inventory';
import { validateSaleInput as validateSaleDomainInput } from './saleDomain';

const refundableStatuses = new Set(['POSTED']);
const cancelableStatuses = new Set(['POSTED']);

function getSalesCollectionRef(storeId) {
  assertFirebaseReady();
  return collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.sales);
}

function buildCreatedBy(createdBy) {
  return {
    id: createdBy?.id ?? createdBy?.uid ?? null,
    name: createdBy?.name ?? createdBy?.operatorName ?? createdBy?.displayName ?? 'Operador local',
    role: createdBy?.role ?? 'operator',
  };
}

function buildOrderSnapshot(orderSnapshot) {
  if (!orderSnapshot) {
    return null;
  }

  return {
    id: orderSnapshot.id,
    code: orderSnapshot.code ?? orderSnapshot.number ?? '',
    status: orderSnapshot.status ?? '',
    domainStatus: normalizeOrderDomainStatus(orderSnapshot.status),
    total: orderSnapshot.totals?.total ?? orderSnapshot.total ?? null,
  };
}

function resolveSaleTotals(data) {
  const totals = data.totals ?? {};
  const subtotal = Number(totals.subtotal ?? data.subtotal ?? 0);
  const freight = Number(totals.freight ?? data.shipping ?? 0);
  const extraAmount = Number(totals.extraAmount ?? data.extraAmount ?? 0);
  const discountPercent = Number(totals.discountPercent ?? data.discountPercent ?? 0);
  const discountValue = Number(totals.discountValue ?? data.discount ?? 0);
  const total = Number(totals.total ?? data.total ?? (subtotal + freight + extraAmount - discountValue));

  return {
    subtotal,
    freight,
    extraAmount,
    discountPercent,
    discountValue,
    total,
  };
}

function mapSnapshot(snapshot) {
  const data = snapshot.data();
  const domainStatus = normalizeSaleDomainStatus(data.status);
  const paymentMethod = normalizePaymentMethod(data.payment?.method ?? data.paymentMethod, null);
  const channel = normalizeChannel(data.channel ?? data.origin ?? data.sourceChannel, null);
  const totals = resolveSaleTotals(data);

  return {
    id: snapshot.id,
    ...data,
    source: normalizeSaleSource(data.source, data.orderId ? 'ORDER' : 'DIRECT'),
    channel,
    channelLabel: channel ? getChannelLabel(channel) : 'Canal nao informado',
    customerSnapshot: {
      id: data.customerSnapshot?.id ?? data.customerId ?? null,
      name: data.customerSnapshot?.name ?? 'Cliente avulso',
      phone: data.customerSnapshot?.phone ?? '',
      neighborhood: data.customerSnapshot?.neighborhood ?? '',
    },
    items: Array.isArray(data.items) ? data.items : [],
    totals,
    payment: paymentMethod
      ? {
        method: paymentMethod,
        label: getPaymentMethodLabel(paymentMethod),
        amount: totals.total,
      }
      : null,
    paymentMethod,
    paymentMethodLabel: paymentMethod ? getPaymentMethodLabel(paymentMethod) : 'Nao informado',
    subtotal: totals.subtotal,
    shipping: totals.freight,
    discount: totals.discountValue,
    total: totals.total,
    domainStatus,
    status: mapSaleDomainStatusToLegacyStatus(domainStatus),
    stockPosted: Boolean(data.stockPosted),
    financialPosted: Boolean(data.financialPosted),
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

export function getSaleStatusMeta(status) {
  const normalized = normalizeSaleDomainStatus(status);

  switch (normalized) {
    case 'CANCELLED':
      return { label: 'Cancelada', badgeClass: 'ui-badge--danger' };
    case 'REVERSED':
      return { label: 'Estornada', badgeClass: 'ui-badge--warning' };
    default:
      return { label: 'Lancada', badgeClass: 'ui-badge--success' };
  }
}

export function validateSaleInput(values) {
  return validateSaleDomainInput(values);
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

export async function createSale({ storeId, tenantId, values, createdBy = null }) {
  const payload = validateSaleDomainInput(values);
  const orderSnapshot = await loadOrderSnapshot(storeId, payload.orderId);

  if (orderSnapshot?.saleId) {
    throw new Error('Este pedido ja possui uma venda vinculada.');
  }

  if (orderSnapshot && payload.customerId && orderSnapshot.customerId && orderSnapshot.customerId !== payload.customerId) {
    throw new Error('Cliente inconsistente com o pedido de origem.');
  }

  const actor = buildCreatedBy(createdBy);
  const saleRef = await addDoc(getSalesCollectionRef(storeId), {
    ...payload,
    orderSnapshot: buildOrderSnapshot(orderSnapshot),
    stockPosted: false,
    financialPosted: false,
    reportingReady: true,
    storeId,
    tenantId: tenantId ?? null,
    createdBy: actor,
    launchedAt: serverTimestamp(),
    launchedBy: actor,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const persistedSale = {
    id: saleRef.id,
    ...payload,
    storeId,
    tenantId: tenantId ?? null,
    createdBy: actor,
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

    await updateDoc(saleRef, {
      stockPosted: true,
      financialPosted: true,
      updatedAt: serverTimestamp(),
    });

    return saleRef.id;
  } catch (error) {
    await deleteDoc(saleRef);
    throw error;
  }
}

export async function createDirectSale({ storeId, tenantId, values, createdBy = null }) {
  return createSale({
    storeId,
    tenantId,
    createdBy,
    values: {
      ...values,
      source: 'DIRECT',
    },
  });
}

export async function createSaleFromOrder({ storeId, tenantId, orderId, values = {}, createdBy = null }) {
  const orderSnapshot = await loadOrderSnapshot(storeId, orderId);

  if (!orderSnapshot) {
    throw new Error('Pedido nao encontrado para gerar venda.');
  }

  if (orderSnapshot.saleId || String(orderSnapshot.saleStatus ?? '').toUpperCase() === 'LAUNCHED') {
    throw new Error('Este pedido ja gerou uma venda.');
  }

  const saleId = await createSale({
    storeId,
    tenantId,
    createdBy,
    values: {
      ...values,
      orderId,
      source: 'ORDER',
      channel: values.channel ?? orderSnapshot.source ?? orderSnapshot.origin,
      customerId: values.customerId ?? orderSnapshot.customerId ?? orderSnapshot.customerSnapshot?.id ?? null,
      customerSnapshot: values.customerSnapshot ?? orderSnapshot.customerSnapshot,
      items: values.items ?? orderSnapshot.items,
      totals: values.totals ?? orderSnapshot.totals ?? {
        subtotal: Number(orderSnapshot.subtotal ?? 0),
        freight: Number(orderSnapshot.shipping ?? 0),
        extraAmount: Number(orderSnapshot.extraAmount ?? 0),
        discountPercent: Number(orderSnapshot.discountPercent ?? 0),
        discountValue: Number(orderSnapshot.discount ?? 0),
        total: Number(orderSnapshot.total ?? 0),
      },
      payment: values.payment ?? orderSnapshot.paymentPreview ?? null,
      paymentMethod: values.paymentMethod ?? orderSnapshot.paymentPreview?.method ?? orderSnapshot.paymentMethod ?? null,
      address: values.address ?? orderSnapshot.address ?? {
        neighborhood: orderSnapshot.neighborhood ?? '',
        addressLine: orderSnapshot.addressLine ?? '',
        reference: orderSnapshot.reference ?? '',
        complement: orderSnapshot.complement ?? '',
      },
      notes: values.notes ?? orderSnapshot.notes ?? '',
    },
  });

  const orderRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.orders, orderId);
  await updateDoc(orderRef, {
    status: 'CONVERTED_TO_SALE',
    saleStatus: 'LAUNCHED',
    saleId,
    updatedAt: serverTimestamp(),
  });

  return saleId;
}

export async function updateSaleStatus({ storeId, saleId, status }) {
  assertFirebaseReady();

  const nextStatus = normalizeSaleDomainStatus(status);

  if (!nextStatus) {
    throw new Error('Status de venda invalido.');
  }

  const saleRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.sales, saleId);
  const snapshot = await getDoc(saleRef);

  if (!snapshot.exists()) {
    throw new Error('Venda nao encontrada.');
  }

  const currentSale = snapshot.data();
  const currentStatus = normalizeSaleDomainStatus(currentSale.status);

  if (nextStatus === 'CANCELLED' && !cancelableStatuses.has(currentStatus)) {
    throw new Error('Esta venda nao pode mais ser cancelada.');
  }

  if (nextStatus === 'REVERSED' && !refundableStatuses.has(currentStatus)) {
    throw new Error('Esta venda nao pode ser estornada.');
  }

  await updateDoc(saleRef, {
    status: nextStatus,
    updatedAt: serverTimestamp(),
  });

  const salePayload = {
    id: saleId,
    ...currentSale,
    status: nextStatus,
    totals: resolveSaleTotals(currentSale),
    payment: currentSale.payment ?? null,
    items: Array.isArray(currentSale.items) ? currentSale.items : [],
  };

  await syncSaleInventory({
    storeId,
    tenantId: currentSale.tenantId ?? null,
    sale: salePayload,
    previousStatus: currentStatus,
  });

  await syncSaleToFinancialEntry({
    storeId,
    tenantId: currentSale.tenantId ?? null,
    sale: salePayload,
  });
}

export async function linkSaleToOrder({ storeId, saleId, orderId }) {
  const orderSnapshot = await loadOrderSnapshot(storeId, orderId);
  assertFirebaseReady();

  const saleRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.sales, saleId);
  await updateDoc(saleRef, {
    orderId: orderSnapshot.id,
    orderSnapshot: buildOrderSnapshot(orderSnapshot),
    updatedAt: serverTimestamp(),
  });
}
