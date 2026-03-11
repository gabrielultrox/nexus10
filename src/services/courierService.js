import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { firebaseDb, firebaseReady } from './firebase';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';
import { loadLocalRecords, saveLocalRecords } from './localRecords';

export const MANUAL_COURIER_STORAGE_KEY = 'nexus-manual-couriers';

function sortCouriers(records) {
  return [...records].sort((left, right) => {
    const leftTime = Date.parse(left?.createdAtClient ?? left?.updatedAtClient ?? '') || 0;
    const rightTime = Date.parse(right?.createdAtClient ?? right?.updatedAtClient ?? '') || 0;

    return rightTime - leftTime;
  });
}

export function subscribeToCouriers(storeId, onData, onError) {
  if (!firebaseReady || !firebaseDb || !storeId) {
    onData(loadLocalRecords(MANUAL_COURIER_STORAGE_KEY, []));
    return () => {};
  }

  const collectionRef = collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.couriers);

  return onSnapshot(
    collectionRef,
    (snapshot) => {
      const records = sortCouriers(snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      })));

      saveLocalRecords(MANUAL_COURIER_STORAGE_KEY, records);
      onData(records);
    },
    (error) => {
      onData(loadLocalRecords(MANUAL_COURIER_STORAGE_KEY, []));
      onError?.(error);
    },
  );
}

export async function saveCourier({ storeId, tenantId, courier }) {
  if (!firebaseReady || !firebaseDb || !storeId) {
    return false;
  }

  const documentRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.couriers, courier.id);
  const timestamp = new Date().toISOString();

  await setDoc(documentRef, {
    ...courier,
    storeId,
    tenantId: tenantId ?? null,
    createdAtClient: courier.createdAtClient ?? timestamp,
    updatedAtClient: timestamp,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return true;
}

export async function deleteCourierRecord({ storeId, courierId }) {
  if (!firebaseReady || !firebaseDb || !storeId) {
    return false;
  }

  await deleteDoc(doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.couriers, courierId));
  return true;
}
