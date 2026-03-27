import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';

import { assertFirebaseReady, canUseRemoteSync, firebaseDb, guardRemoteSubscription } from './firebase';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';
import {
  buildExternalOrderDocumentId,
  normalizeExternalOrderRecord,
} from './integrations/externalOrderModel';

function mapSnapshot(documentSnapshot) {
  return {
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  };
}

function getScopedCollectionRef(storeId, collectionName) {
  assertFirebaseReady();
  return collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, collectionName);
}

function getScopedDocumentRef(storeId, collectionName, documentId) {
  assertFirebaseReady();
  return doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, collectionName, documentId);
}

export function getExternalOrderDocumentId({ source, merchantId, externalOrderId }) {
  return buildExternalOrderDocumentId(source, merchantId, externalOrderId);
}

export function subscribeToExternalOrders(storeId, onData, onError) {
  if (!storeId || !canUseRemoteSync()) {
    onData([]);
    return () => {};
  }

  const ordersQuery = query(
    getScopedCollectionRef(storeId, FIRESTORE_COLLECTIONS.externalOrders),
    orderBy('updatedAt', 'desc'),
    limit(100),
  );

  return guardRemoteSubscription(
    () => onSnapshot(
      ordersQuery,
      (snapshot) => {
        onData(snapshot.docs.map((documentSnapshot) => normalizeExternalOrderRecord({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        })));
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

export function subscribeToExternalOrderEvents(storeId, externalOrderId, onData, onError) {
  if (!storeId || !externalOrderId || !canUseRemoteSync()) {
    onData([]);
    return () => {};
  }

  const eventsQuery = query(
    getScopedCollectionRef(storeId, FIRESTORE_COLLECTIONS.externalOrderEvents),
    where('externalOrderId', '==', externalOrderId),
    orderBy('createdAt', 'desc'),
    limit(100),
  );

  return guardRemoteSubscription(
    () => onSnapshot(
      eventsQuery,
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

export function subscribeToExternalOrderTracking(storeId, externalOrderId, onData, onError) {
  if (!storeId || !externalOrderId || !canUseRemoteSync()) {
    onData([]);
    return () => {};
  }

  const trackingQuery = query(
    getScopedCollectionRef(storeId, FIRESTORE_COLLECTIONS.externalOrderTracking),
    where('externalOrderId', '==', externalOrderId),
    orderBy('happenedAt', 'desc'),
    limit(100),
  );

  return guardRemoteSubscription(
    () => onSnapshot(
      trackingQuery,
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

export function subscribeToIntegrationLogs(storeId, source, onData, onError) {
  if (!storeId || !source || !canUseRemoteSync()) {
    onData([]);
    return () => {};
  }

  const logsQuery = query(
    getScopedCollectionRef(storeId, FIRESTORE_COLLECTIONS.integrationLogs),
    where('source', '==', source),
    orderBy('createdAt', 'desc'),
    limit(100),
  );

  return guardRemoteSubscription(
    () => onSnapshot(
      logsQuery,
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

export function subscribeToIntegrationMerchants(storeId, source, onData, onError) {
  if (!storeId || !source || !canUseRemoteSync()) {
    onData([]);
    return () => {};
  }

  const merchantsQuery = query(
    getScopedCollectionRef(storeId, FIRESTORE_COLLECTIONS.integrationMerchants),
    where('source', '==', source),
    orderBy('updatedAt', 'desc'),
    limit(100),
  );

  return guardRemoteSubscription(
    () => onSnapshot(
      merchantsQuery,
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

export async function hasExternalEventBeenProcessed(storeId, eventId) {
  const snapshot = await getDoc(getScopedDocumentRef(storeId, FIRESTORE_COLLECTIONS.externalOrderEvents, eventId));
  return snapshot.exists();
}

export async function upsertExternalOrder({
  storeId,
  tenantId,
  order,
}) {
  const normalizedOrder = normalizeExternalOrderRecord(order);
  const documentId = getExternalOrderDocumentId(normalizedOrder);

  await setDoc(
    getScopedDocumentRef(storeId, FIRESTORE_COLLECTIONS.externalOrders, documentId),
    {
      ...normalizedOrder,
      storeId,
      tenantId: tenantId ?? null,
      updatedAt: normalizedOrder.updatedAt ?? new Date().toISOString(),
      firestoreUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return documentId;
}

export async function upsertExternalOrderEvent({
  storeId,
  tenantId,
  event,
}) {
  await setDoc(
    getScopedDocumentRef(storeId, FIRESTORE_COLLECTIONS.externalOrderEvents, event.id),
    {
      ...event,
      storeId,
      tenantId: tenantId ?? null,
      processedAt: event.processedAt ?? new Date().toISOString(),
      firestoreUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function upsertExternalOrderTracking({
  storeId,
  tenantId,
  trackingEntry,
}) {
  await setDoc(
    getScopedDocumentRef(storeId, FIRESTORE_COLLECTIONS.externalOrderTracking, trackingEntry.id),
    {
      ...trackingEntry,
      storeId,
      tenantId: tenantId ?? null,
      firestoreUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function appendIntegrationLog({
  storeId,
  tenantId,
  log,
}) {
  const logId = log.id ?? `${log.source ?? 'integration'}:${Date.now()}:${Math.random().toString(16).slice(2, 8)}`;

  await setDoc(
    getScopedDocumentRef(storeId, FIRESTORE_COLLECTIONS.integrationLogs, logId),
    {
      ...log,
      id: logId,
      storeId,
      tenantId: tenantId ?? null,
      createdAt: log.createdAt ?? new Date().toISOString(),
      firestoreCreatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function upsertIntegrationMerchantConfig({
  storeId,
  tenantId,
  merchantConfig,
}) {
  await setDoc(
    getScopedDocumentRef(storeId, FIRESTORE_COLLECTIONS.integrationMerchants, merchantConfig.merchantId),
    {
      ...merchantConfig,
      storeId,
      tenantId: tenantId ?? null,
      updatedAt: merchantConfig.updatedAt ?? new Date().toISOString(),
      firestoreUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
