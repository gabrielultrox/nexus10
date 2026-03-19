import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { firebaseDb, firebaseReady, guardRemoteSubscription } from './firebase';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';
import {
  loadLocalRecords,
  loadResettableLocalRecords,
  resetLocalRecordsNow,
  saveLocalRecords,
  saveResettableLocalRecords,
} from './localAccess';

function getOperationalDay(resetHour = 3) {
  const now = new Date();
  const operationalDate = new Date(now);

  if (now.getHours() < resetHour) {
    operationalDate.setDate(operationalDate.getDate() - 1);
  }

  const year = operationalDate.getFullYear();
  const month = String(operationalDate.getMonth() + 1).padStart(2, '0');
  const day = String(operationalDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getFallbackRecords(storageKey, initialRecords, dailyResetHour) {
  if (dailyResetHour != null) {
    return loadResettableLocalRecords(storageKey, initialRecords, dailyResetHour);
  }

  return loadLocalRecords(storageKey, initialRecords);
}

function saveFallbackRecords(storageKey, records, dailyResetHour) {
  if (dailyResetHour != null) {
    saveResettableLocalRecords(storageKey, records, dailyResetHour);
    return;
  }

  saveLocalRecords(storageKey, records);
}

function sortRecords(records) {
  return [...records].sort((left, right) => {
    const leftTime = Date.parse(left?.updatedAtClient ?? left?.createdAtClient ?? '') || 0;
    const rightTime = Date.parse(right?.updatedAtClient ?? right?.createdAtClient ?? '') || 0;

    return rightTime - leftTime;
  });
}

function formatAuditTime(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function resolveTextValue(value) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => resolveTextValue(entry)).filter(Boolean).join(' / ');
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const knownKeys = ['operatorName', 'displayName', 'name', 'label', 'value', 'title', 'text'];

  for (const key of knownKeys) {
    const resolved = resolveTextValue(value[key]);

    if (resolved) {
      return resolved;
    }
  }

  return '';
}

function resolveAuditLabel(record) {
  const directValue = resolveTextValue(record.updatedAt);

  if (directValue && directValue !== '[object Object]') {
    return directValue;
  }

  if (record.updatedAt?.toDate instanceof Function) {
    return formatAuditTime(record.updatedAt.toDate());
  }

  if (typeof record.updatedAt?.seconds === 'number') {
    return formatAuditTime(record.updatedAt.seconds * 1000);
  }

  return formatAuditTime(record.updatedAtClient);
}

function normalizeScheduleEntryTime(value) {
  const resolved = resolveTextValue(value)

  if (!resolved) {
    return ''
  }

  const [entryTime] = resolved
    .replace(/\s+/g, '')
    .split('-')
    .filter(Boolean)

  return entryTime ?? resolved
}

function normalizeRecord(record) {
  const textFields = [
    'courier',
    'updatedBy',
    'holder',
    'device',
    'model',
    'status',
    'machineStatus',
    'deliveryCode',
    'code',
    'order',
    'origin',
    'destination',
    'window',
    'machine',
    'recipient',
    'owner',
    'type',
    'reason',
    'districts',
    'confirmed',
    'value',
    'date',
    'zone',
  ];

  const normalizedRecord = { ...record };

  textFields.forEach((field) => {
    if (field in normalizedRecord) {
      normalizedRecord[field] = field === 'window'
        ? normalizeScheduleEntryTime(normalizedRecord[field])
        : resolveTextValue(normalizedRecord[field]);
    }
  });

  normalizedRecord.updatedAt = resolveAuditLabel(record);
  normalizedRecord.updatedBy = resolveTextValue(record.updatedBy);

  return normalizedRecord;
}

function getModuleRecordsCollectionRef(storeId, modulePath) {
  return collection(
    firebaseDb,
    FIRESTORE_COLLECTIONS.stores,
    storeId,
    FIRESTORE_COLLECTIONS.manualModules,
    modulePath,
    'records',
  );
}

export function subscribeToManualModuleRecords({
  storeId,
  modulePath,
  storageKey,
  initialRecords = [],
  dailyResetHour = null,
  onData,
  onError,
}) {
  if (!firebaseReady || !firebaseDb || !storeId) {
    onData(getFallbackRecords(storageKey, initialRecords, dailyResetHour));
    return () => {};
  }

  return guardRemoteSubscription(
    () => onSnapshot(
      getModuleRecordsCollectionRef(storeId, modulePath),
      (snapshot) => {
        const currentOperationalDay = dailyResetHour != null ? getOperationalDay(dailyResetHour) : null;
        const remoteRecords = snapshot.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        })).map(normalizeRecord);
        const filteredRecords = currentOperationalDay
          ? remoteRecords.filter((record) => record.operationalDay === currentOperationalDay)
          : remoteRecords;
        const sortedRecords = sortRecords(filteredRecords);

        saveFallbackRecords(storageKey, sortedRecords, dailyResetHour);
        onData(sortedRecords);
      },
      (error) => {
        onData(getFallbackRecords(storageKey, initialRecords, dailyResetHour));
        onError?.(error);
      },
    ),
    {
      onFallback() {
        onData(getFallbackRecords(storageKey, initialRecords, dailyResetHour));
      },
      onError,
    },
  );
}

export async function saveManualModuleRecord({
  storeId,
  tenantId,
  modulePath,
  dailyResetHour = null,
  record,
}) {
  if (!firebaseReady || !firebaseDb || !storeId) {
    return false;
  }

  const timestamp = new Date().toISOString();
  const documentRef = doc(getModuleRecordsCollectionRef(storeId, modulePath), record.id);

  await setDoc(documentRef, {
    ...record,
    storeId,
    tenantId: tenantId ?? null,
    modulePath,
    operationalDay: dailyResetHour != null ? getOperationalDay(dailyResetHour) : null,
    createdAtClient: record.createdAtClient ?? timestamp,
    updatedAtClient: timestamp,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  }, { merge: true });

  return true;
}

export async function deleteManualModuleRecord({ storeId, modulePath, recordId }) {
  if (!firebaseReady || !firebaseDb || !storeId) {
    return false;
  }

  await deleteDoc(doc(getModuleRecordsCollectionRef(storeId, modulePath), recordId));
  return true;
}

export async function clearManualModuleRecords({
  storeId,
  modulePath,
  storageKey,
  initialRecords = [],
  dailyResetHour = null,
}) {
  if (!firebaseReady || !firebaseDb || !storeId) {
    if (dailyResetHour != null) {
      resetLocalRecordsNow(storageKey, initialRecords, dailyResetHour);
    } else {
      saveLocalRecords(storageKey, initialRecords);
    }
    return false;
  }

  const snapshot = await getDocs(getModuleRecordsCollectionRef(storeId, modulePath));
  const currentOperationalDay = dailyResetHour != null ? getOperationalDay(dailyResetHour) : null;
  const deletions = snapshot.docs
    .filter((documentSnapshot) => {
      if (!currentOperationalDay) {
        return true;
      }

      return documentSnapshot.data()?.operationalDay === currentOperationalDay;
    })
    .map((documentSnapshot) => deleteDoc(documentSnapshot.ref));

  await Promise.all(deletions);
  return true;
}
