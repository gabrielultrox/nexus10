import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';

import { assertFirebaseReady, canUseRemoteSync, firebaseDb, guardRemoteSubscription } from './firebase';
import { buildStoreQueryCacheKey, getPaginatedStoreCollectionDocuments, invalidateQueryCache } from './firestore';
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

export function subscribeToFinancialEntries(storeId, onData, onError) {
  if (!storeId || !canUseRemoteSync()) {
    onData([]);
    return () => {};
  }

  const entriesQuery = query(getFinancialEntriesCollectionRef(storeId), orderBy('createdAt', 'desc'));

  return guardRemoteSubscription(
    () => onSnapshot(
      entriesQuery,
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

export function subscribeToFinancialClosures(storeId, onData, onError) {
  if (!storeId || !canUseRemoteSync()) {
    onData([]);
    return () => {};
  }

  const closuresQuery = query(getFinancialClosuresCollectionRef(storeId), orderBy('createdAt', 'desc'));

  return guardRemoteSubscription(
    () => onSnapshot(
      closuresQuery,
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

export async function listFinancialClosuresPage({
  storeId,
  pageSize = 50,
  cursor = null,
} = {}) {
  if (!storeId || !canUseRemoteSync()) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    };
  }

  return getPaginatedStoreCollectionDocuments(storeId, FIRESTORE_COLLECTIONS.financialClosures, {
    orderField: 'createdAt',
    orderDirection: 'desc',
    pageSize,
    cursor,
    cacheKey: buildStoreQueryCacheKey(storeId, FIRESTORE_COLLECTIONS.financialClosures, 'page-by-createdAt'),
  });
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

  invalidateQueryCache(buildStoreQueryCacheKey(storeId, FIRESTORE_COLLECTIONS.financialEntries));
  return entryRef.id;
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

  invalidateQueryCache(buildStoreQueryCacheKey(storeId, FIRESTORE_COLLECTIONS.financialClosures));
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
