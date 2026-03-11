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
} from './localRecords';

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
        }));
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
  storageKey,
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
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
