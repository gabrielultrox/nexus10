import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'

import { firebaseDb, firebaseReady } from './firebase'
import { FIRESTORE_COLLECTIONS } from './firestoreCollections'

function normalizeOperatorPreferenceKey(operatorName = '') {
  return String(operatorName ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

function getUiPreferencesRef(storeId, operatorName) {
  return doc(
    firebaseDb,
    FIRESTORE_COLLECTIONS.stores,
    storeId,
    FIRESTORE_COLLECTIONS.uiPreferences,
    normalizeOperatorPreferenceKey(operatorName),
  )
}

export async function loadRemoteUiPreferences({ storeId, operatorName }) {
  if (!firebaseReady || !firebaseDb || !storeId || !operatorName) {
    return null
  }

  const snapshot = await getDoc(getUiPreferencesRef(storeId, operatorName))
  return snapshot.exists() ? snapshot.data() : null
}

export async function persistRemoteUiPreferences({ storeId, operatorName, preferences }) {
  if (!firebaseReady || !firebaseDb || !storeId || !operatorName) {
    return preferences ?? null
  }

  const normalizedPreferences = {
    ...preferences,
    operatorName,
    updatedAt: new Date().toISOString(),
  }

  await setDoc(
    getUiPreferencesRef(storeId, operatorName),
    {
      ...normalizedPreferences,
      updatedAtServer: serverTimestamp(),
    },
    { merge: true },
  )

  return normalizedPreferences
}
