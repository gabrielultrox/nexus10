import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';

import { requestBackend } from './backendApi';
import { assertFirebaseReady, canUseRemoteSync, createRemoteSyncError, firebaseDb, guardRemoteSubscription } from './firebase';
import {
  getChannelLabel,
  getPaymentMethodLabel,
  mapSaleDomainStatusToLegacyStatus,
  normalizeChannel,
  normalizePaymentMethod,
  normalizeSaleDomainStatus,
  normalizeSaleSource,
} from './commerce';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';
import { validateSaleInput as validateSaleDomainInput } from './saleDomain';

function getSalesCollectionRef(storeId) {
  assertFirebaseReady();
  return collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.sales);
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

function parseDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapSnapshot(snapshot) {
  const data = snapshot.data();
  const domainStatus = normalizeSaleDomainStatus(data.status);
  const paymentMethod = normalizePaymentMethod(data.payment?.method ?? data.paymentMethod, null);
  const channel = normalizeChannel(data.channel ?? data.origin ?? data.sourceChannel, null);
  const totals = resolveSaleTotals(data);
  const items = Array.isArray(data.items)
    ? data.items.map((item) => ({
      ...item,
      name: item.productSnapshot?.name ?? item.name ?? 'Item',
      total: Number(item.totalPrice ?? item.total ?? 0),
    }))
    : [];

  return {
    id: snapshot.id,
    ...data,
    code: data.code ?? snapshot.id,
    number: data.code?.trim() || `#${snapshot.id.slice(0, 6).toUpperCase()}`,
    source: normalizeSaleSource(data.source, data.orderId ? 'ORDER' : 'DIRECT'),
    channel,
    channelLabel: channel ? getChannelLabel(channel) : 'Canal nao informado',
    customerSnapshot: {
      id: data.customerSnapshot?.id ?? data.customerId ?? null,
      name: data.customerSnapshot?.name ?? 'Cliente avulso',
      phone: data.customerSnapshot?.phone ?? '',
      neighborhood: data.customerSnapshot?.neighborhood ?? '',
    },
    items,
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
    createdAtDate: parseDate(data.createdAt),
    updatedAtDate: parseDate(data.updatedAt),
    launchedAtDate: parseDate(data.launchedAt),
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
  if (!storeId || !canUseRemoteSync()) {
    onData([]);
    return () => {};
  }

  const salesQuery = query(getSalesCollectionRef(storeId), orderBy('createdAt', 'desc'));

  return guardRemoteSubscription(
    () => onSnapshot(
      salesQuery,
      (snapshot) => {
        onData(snapshot.docs.map(mapSnapshot));
      },
      onError,
    ),
    {
      onFallback() {
        onData([]);
      },
      onError,
    },
  );
}

export async function getSaleById({ storeId, saleId }) {
  if (!canUseRemoteSync()) {
    throw createRemoteSyncError();
  }

  assertFirebaseReady();
  const saleRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.sales, saleId);
  const snapshot = await getDoc(saleRef);

  if (!snapshot.exists()) {
    return null;
  }

  return mapSnapshot(snapshot);
}

export async function createSale({ storeId, tenantId, values, createdBy = null }) {
  validateSaleDomainInput(values);

  const data = await requestBackend(`/stores/${storeId}/sales`, {
    method: 'POST',
    body: {
      tenantId: tenantId ?? null,
      values,
      createdBy,
    },
  });

  return data.id;
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
  const data = await requestBackend(`/stores/${storeId}/orders/${orderId}/sales`, {
    method: 'POST',
    body: {
      tenantId: tenantId ?? null,
      values,
      createdBy,
    },
  });

  return data.saleId;
}

export async function updateSaleStatus({ storeId, saleId, status, actor = null }) {
  const data = await requestBackend(`/stores/${storeId}/sales/${saleId}/status`, {
    method: 'PATCH',
    body: {
      status,
      actor,
      createdBy: actor,
    },
  });

  return data.id;
}
