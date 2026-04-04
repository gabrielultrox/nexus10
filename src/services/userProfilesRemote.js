import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'

import { canUseRemoteSync, firebaseDb } from './firebaseFirestoreRuntime'
import { FIRESTORE_COLLECTIONS } from './firestoreCollections'
import { normalizeRole } from './permissions'

export async function resolveRemoteUserProfileByOperator(fallback) {
  if (!firebaseDb || !canUseRemoteSync()) {
    return fallback
  }

  const userRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.users, fallback.uid)
  const snapshot = await getDoc(userRef)

  if (!snapshot.exists()) {
    await setDoc(
      userRef,
      {
        ...fallback,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    return fallback
  }

  const profileData = snapshot.data()

  return {
    ...fallback,
    ...profileData,
    uid: snapshot.id,
    operatorName: profileData.operatorName ?? fallback.operatorName,
    displayName: profileData.displayName ?? fallback.displayName,
    role: normalizeRole(profileData.role ?? fallback.role),
    tenantId: profileData.tenantId ?? fallback.tenantId,
    storeIds:
      Array.isArray(profileData.storeIds) && profileData.storeIds.length > 0
        ? profileData.storeIds
        : fallback.storeIds,
    defaultStoreId:
      profileData.defaultStoreId ??
      (Array.isArray(profileData.storeIds) && profileData.storeIds[0]) ??
      fallback.defaultStoreId,
    status: profileData.status ?? fallback.status,
  }
}
