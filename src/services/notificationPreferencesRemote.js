import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'

import { firebaseDb, firebaseReady, guardRemoteSubscription } from './firebase'
import { FIRESTORE_COLLECTIONS } from './firestoreCollections'
import {
  buildDefaultNotificationPreferences,
  loadNotificationPreferences,
  saveNotificationPreferencesLocally,
} from './notificationService'

function getNotificationPreferencesRef(storeId, userId) {
  return doc(
    firebaseDb,
    FIRESTORE_COLLECTIONS.stores,
    storeId,
    FIRESTORE_COLLECTIONS.notificationsPreferences,
    userId,
  )
}

export function subscribeToNotificationPreferences({ storeId, userId, session, onData, onError }) {
  const defaults = loadNotificationPreferences({ storeId, userId, session })
  onData(defaults)

  if (!firebaseReady || !firebaseDb || !storeId || !userId) {
    return () => {}
  }

  return guardRemoteSubscription(
    () =>
      onSnapshot(
        getNotificationPreferencesRef(storeId, userId),
        (snapshot) => {
          const remote = snapshot.exists() ? snapshot.data() : {}
          const nextPreferences = {
            ...defaults,
            ...remote,
            channels: { ...defaults.channels, ...(remote?.channels ?? {}) },
            types: { ...defaults.types, ...(remote?.types ?? {}) },
          }

          saveNotificationPreferencesLocally({ storeId, userId, preferences: nextPreferences })
          onData(nextPreferences)
        },
        onError,
      ),
    {
      onFallback() {
        onData(defaults)
      },
      onError,
    },
  )
}

export async function persistNotificationPreferences({ storeId, userId, session, preferences }) {
  const defaults = buildDefaultNotificationPreferences(session)
  const nextPreferences = {
    ...defaults,
    ...preferences,
    channels: { ...defaults.channels, ...(preferences?.channels ?? {}) },
    types: { ...defaults.types, ...(preferences?.types ?? {}) },
    updatedAt: new Date().toISOString(),
  }

  saveNotificationPreferencesLocally({ storeId, userId, preferences: nextPreferences })

  if (!firebaseReady || !firebaseDb || !storeId || !userId) {
    return nextPreferences
  }

  await setDoc(
    getNotificationPreferencesRef(storeId, userId),
    {
      ...nextPreferences,
      updatedBy: userId,
      updatedAtServer: serverTimestamp(),
    },
    { merge: true },
  )

  return nextPreferences
}
