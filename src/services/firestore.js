import {
  collection,
  collectionGroup,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore';

import { assertFirebaseReady, firebaseDb } from './firebase';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';

const DEFAULT_QUERY_CACHE_TTL_MS = 15_000;
const queryResultCache = new Map();

function readQueryCacheEntry(cacheKey) {
  if (!cacheKey) {
    return null;
  }

  const cached = queryResultCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    queryResultCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function writeQueryCacheEntry(cacheKey, value, ttlMs = DEFAULT_QUERY_CACHE_TTL_MS) {
  if (!cacheKey) {
    return value;
  }

  queryResultCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + Math.max(0, ttlMs),
  });

  return value;
}

function mapDocumentSnapshot(documentSnapshot) {
  return {
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  };
}

function normalizeCursorValue(value) {
  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }

  return value ?? null;
}

function toFirestoreCursorTuple(cursor) {
  if (!cursor?.id || cursor.value == null) {
    return null;
  }

  return [normalizeCursorValue(cursor.value), cursor.id];
}

export async function getDocument(collectionName, documentId) {
  assertFirebaseReady();

  const documentRef = doc(firebaseDb, collectionName, documentId);
  const snapshot = await getDoc(documentRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export async function setDocument(collectionName, documentId, data, options = {}) {
  assertFirebaseReady();

  const documentRef = doc(firebaseDb, collectionName, documentId);

  await setDoc(
    documentRef,
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    options,
  );
}

export async function updateDocument(collectionName, documentId, data) {
  assertFirebaseReady();

  const documentRef = doc(firebaseDb, collectionName, documentId);

  await updateDoc(documentRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function getCollectionDocuments(collectionName) {
  assertFirebaseReady();

  const collectionRef = collection(firebaseDb, collectionName);
  const snapshot = await getDocs(collectionRef);

  return snapshot.docs.map((documentSnapshot) => ({
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  }));
}

export function buildStoreQueryCacheKey(storeId, collectionName, descriptor = 'default') {
  return [storeId, collectionName, descriptor].filter(Boolean).join('::');
}

export function invalidateQueryCache(matchers = []) {
  const normalizedMatchers = Array.isArray(matchers) ? matchers.filter(Boolean) : [matchers].filter(Boolean);

  if (normalizedMatchers.length === 0) {
    queryResultCache.clear();
    return;
  }

  for (const cacheKey of queryResultCache.keys()) {
    if (normalizedMatchers.some((matcher) => cacheKey.startsWith(matcher))) {
      queryResultCache.delete(cacheKey);
    }
  }
}

export function createPaginationCursor(documentSnapshot, orderField = 'createdAt') {
  if (!documentSnapshot) {
    return null;
  }

  const data = typeof documentSnapshot.data === 'function' ? documentSnapshot.data() : documentSnapshot;
  const id = documentSnapshot.id ?? data?.id ?? null;

  if (!id) {
    return null;
  }

  return {
    id,
    orderField,
    value: normalizeCursorValue(data?.[orderField]),
  };
}

export function buildStoreScopedData(storeId, data, extra = {}) {
  return {
    ...data,
    storeId,
    ...extra,
  };
}

export function getStoreDocumentRef(storeId, collectionName, documentId) {
  assertFirebaseReady();
  return doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, collectionName, documentId);
}

export function getStoreCollectionRef(storeId, collectionName) {
  assertFirebaseReady();
  return collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, collectionName);
}

export async function getStoreDocument(storeId, collectionName, documentId) {
  const documentRef = getStoreDocumentRef(storeId, collectionName, documentId);
  const snapshot = await getDoc(documentRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export async function setStoreDocument(storeId, collectionName, documentId, data, options = {}) {
  const documentRef = getStoreDocumentRef(storeId, collectionName, documentId);

  await setDoc(
    documentRef,
    {
      ...buildStoreScopedData(storeId, data),
      updatedAt: serverTimestamp(),
    },
    options,
  );
}

export async function updateStoreDocument(storeId, collectionName, documentId, data) {
  const documentRef = getStoreDocumentRef(storeId, collectionName, documentId);

  await updateDoc(documentRef, {
    ...buildStoreScopedData(storeId, data),
    updatedAt: serverTimestamp(),
  });
}

export function createStoreScopedQuery(storeId, collectionName, constraints = []) {
  const collectionRef = getStoreCollectionRef(storeId, collectionName);
  return query(collectionRef, ...constraints);
}

export async function getStoreCollectionDocuments(storeId, collectionName, constraints = []) {
  const storeQuery = createStoreScopedQuery(storeId, collectionName, constraints);
  const snapshot = await getDocs(storeQuery);

  return snapshot.docs.map(mapDocumentSnapshot);
}

export function createStoreCollectionGroupQuery(storeId, collectionName, constraints = []) {
  assertFirebaseReady();

  return query(
    collectionGroup(firebaseDb, collectionName),
    where('storeId', '==', storeId),
    ...constraints,
  );
}

export async function getPaginatedStoreCollectionDocuments(
  storeId,
  collectionName,
  {
    filters = [],
    orderField = 'createdAt',
    orderDirection = 'desc',
    pageSize = 50,
    cursor = null,
    cacheKey = null,
    cacheTtlMs = DEFAULT_QUERY_CACHE_TTL_MS,
  } = {},
) {
  const cursorTuple = toFirestoreCursorTuple(cursor);
  const resolvedCacheKey = cacheKey
    ? `${cacheKey}::${cursor?.id ?? 'initial'}::${pageSize}`
    : null;
  const cached = readQueryCacheEntry(resolvedCacheKey);

  if (cached) {
    return cached;
  }

  const constraints = [
    ...filters,
    orderBy(orderField, orderDirection),
    orderBy(documentId(), orderDirection),
  ];

  if (cursorTuple) {
    constraints.push(startAfter(...cursorTuple));
  }

  constraints.push(limit(pageSize));

  const snapshot = await getDocs(createStoreScopedQuery(storeId, collectionName, constraints));
  const items = snapshot.docs.map(mapDocumentSnapshot);
  const lastVisible = snapshot.docs.at(-1) ?? null;
  const result = {
    items,
    nextCursor: snapshot.docs.length < pageSize ? null : createPaginationCursor(lastVisible, orderField),
    hasMore: snapshot.docs.length === pageSize,
  };

  return writeQueryCacheEntry(resolvedCacheKey, result, cacheTtlMs);
}

export async function getStoreDocumentsByIds(storeId, collectionName, documentIds = []) {
  const uniqueIds = Array.from(new Set((documentIds ?? []).filter(Boolean)));

  if (uniqueIds.length === 0) {
    return [];
  }

  const chunks = [];

  for (let index = 0; index < uniqueIds.length; index += 10) {
    chunks.push(uniqueIds.slice(index, index + 10));
  }

  const snapshots = await Promise.all(
    chunks.map((chunk) => getDocs(createStoreScopedQuery(storeId, collectionName, [
      where(documentId(), 'in', chunk),
    ]))),
  );

  return snapshots.flatMap((snapshot) => snapshot.docs.map(mapDocumentSnapshot));
}
