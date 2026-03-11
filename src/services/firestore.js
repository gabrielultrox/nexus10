import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { assertFirebaseReady, firebaseDb } from './firebase';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';

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

  return snapshot.docs.map((documentSnapshot) => ({
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  }));
}

export function createStoreCollectionGroupQuery(storeId, collectionName, constraints = []) {
  assertFirebaseReady();

  return query(
    collectionGroup(firebaseDb, collectionName),
    where('storeId', '==', storeId),
    ...constraints,
  );
}
