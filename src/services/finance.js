import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import {
  normalizePaymentMethod,
  normalizeSaleDomainStatus,
} from './commerce';
import { assertFirebaseReady, firebaseDb } from './firebase';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';

const financeTypes = new Set(['entrada', 'saida']);
const financeSources = new Set(['venda', 'manual']);

function parseMoney(value, fieldLabel) {
  const normalized = String(value ?? '').replace(/\s+/g, '').replace(',', '.');
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} invalido.`);
  }

  return Number(parsed.toFixed(2));
}

function mapSnapshot(snapshot) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

function getFinancialEntriesCollectionRef(storeId) {
  assertFirebaseReady();
  return collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.financialEntries);
}

function getFinancialClosuresCollectionRef(storeId) {
  assertFirebaseReady();
  return collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.financialClosures);
}

function getFinancialEntryRef(storeId, entryId) {
  assertFirebaseReady();
  return doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.financialEntries, entryId);
}

function buildSaleEntryId(saleId) {
  return `sale-${saleId}`;
}

function getSaleFinancialStatus(saleStatus) {
  switch (normalizeSaleDomainStatus(saleStatus)) {
    case 'CANCELLED':
      return 'cancelada';
    case 'REVERSED':
      return 'estornada';
    default:
      return 'ativa';
  }
}

function buildSaleFinanceDescription(sale) {
  const customerName = sale.customerSnapshot?.name?.trim();
  return customerName
    ? `Venda ${sale.code ?? sale.id} - ${customerName}`
    : `Venda ${sale.code ?? sale.id}`;
}

export function subscribeToFinancialEntries(storeId, onData, onError) {
  const entriesQuery = query(getFinancialEntriesCollectionRef(storeId), orderBy('createdAt', 'desc'));

  return onSnapshot(
    entriesQuery,
    (snapshot) => {
      onData(snapshot.docs.map(mapSnapshot));
    },
    onError,
  );
}

export function subscribeToFinancialClosures(storeId, onData, onError) {
  const closuresQuery = query(getFinancialClosuresCollectionRef(storeId), orderBy('createdAt', 'desc'));

  return onSnapshot(
    closuresQuery,
    (snapshot) => {
      onData(snapshot.docs.map(mapSnapshot));
    },
    onError,
  );
}

export function validateManualExpenseInput(values) {
  const description = values.description?.trim();
  const cashierName = values.cashierName?.trim() || 'Geral';
  const occurredAt = values.occurredAt?.trim();

  if (!description) {
    throw new Error('Informe a descricao da saida.');
  }

  if (!occurredAt) {
    throw new Error('Informe a data da saida.');
  }

  return {
    type: 'saida',
    source: 'manual',
    relatedSaleId: null,
    description,
    amount: parseMoney(values.amount, 'Valor'),
    cashierName,
    occurredAt,
    status: 'ativa',
  };
}

export async function createManualExpense({ storeId, tenantId, values }) {
  const payload = validateManualExpenseInput(values);

  const entryRef = await addDoc(getFinancialEntriesCollectionRef(storeId), {
    ...payload,
    storeId,
    tenantId: tenantId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return entryRef.id;
}

export async function syncSaleToFinancialEntry({ storeId, tenantId, sale }) {
  assertFirebaseReady();

  if (!sale?.id) {
    throw new Error('Venda invalida para sincronizacao financeira.');
  }

  const entryRef = getFinancialEntryRef(storeId, buildSaleEntryId(sale.id));
  const existingSnapshot = await getDoc(entryRef);
  const currentCreatedAt = existingSnapshot.exists() ? existingSnapshot.data().createdAt ?? null : null;
  const normalizedCreatedAt = typeof sale.createdAt?.toDate === 'function'
    ? sale.createdAt
    : serverTimestamp();

  await setDoc(entryRef, {
    type: 'entrada',
    source: 'venda',
    relatedSaleId: sale.id,
    description: buildSaleFinanceDescription(sale),
    amount: Number(sale.totals?.total ?? sale.total ?? 0),
    paymentMethod: normalizePaymentMethod(sale.payment?.method ?? sale.paymentMethod, null) ?? '',
    status: getSaleFinancialStatus(sale.status ?? 'POSTED'),
    storeId,
    tenantId: tenantId ?? sale.tenantId ?? null,
    createdAt: currentCreatedAt ?? normalizedCreatedAt,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function reconcileSalesToFinancialEntries({ storeId, tenantId, sales }) {
  const validSales = Array.isArray(sales) ? sales.filter((sale) => sale?.id) : [];

  await Promise.all(validSales.map((sale) => syncSaleToFinancialEntry({
    storeId,
    tenantId,
    sale,
  })));
}

export async function createFinancialClosure({ storeId, tenantId, values }) {
  const cashierName = values.cashierName?.trim() || 'Geral';
  const startDate = values.startDate?.trim();
  const endDate = values.endDate?.trim();

  if (!startDate || !endDate) {
    throw new Error('Informe o periodo do fechamento.');
  }

  const totalIncome = parseMoney(values.totalIncome, 'Entradas');
  const totalExpense = parseMoney(values.totalExpense, 'Saidas');
  const balance = parseMoney(values.balance, 'Saldo');

  const closureRef = await addDoc(getFinancialClosuresCollectionRef(storeId), {
    cashierName,
    startDate,
    endDate,
    totalIncome,
    totalExpense,
    balance,
    storeId,
    tenantId: tenantId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return closureRef.id;
}

export function getFinanceEntryDirection(entry) {
  if (!financeTypes.has(entry.type)) {
    return 'saida';
  }

  return entry.type;
}

export function getFinanceEntryBadge(entry) {
  if (getFinanceEntryDirection(entry) === 'entrada') {
    return { label: 'Entrada', badgeClass: 'ui-badge--success' };
  }

  return { label: 'Saida', badgeClass: 'ui-badge--danger' };
}

export function isFinanceEntryActive(entry) {
  return (entry.status ?? 'ativa') === 'ativa';
}

export function validateFinanceEntry(entry) {
  return financeTypes.has(entry.type) && financeSources.has(entry.source);
}
