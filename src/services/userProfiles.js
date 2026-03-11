import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { firebaseDb, firebaseReady } from './firebase';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';
import { normalizeRole, roles } from './permissions';

const DEFAULT_TENANT_ID = 'hora-dez';
const DEFAULT_STORE_ID = 'hora-dez';

export const localOperatorProfiles = [
  { operatorName: 'Gabriel', role: roles.admin },
  { operatorName: 'Maria Eduarda', role: roles.gerente },
  { operatorName: 'Rafael', role: roles.operador },
  { operatorName: 'Ana Vitoria', role: roles.atendente },
  { operatorName: 'Rosa', role: roles.operador },
];

function slugifyOperatorName(operatorName) {
  return operatorName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function createLocalUserId(operatorName) {
  return `local-${slugifyOperatorName(operatorName)}`;
}

export function getDefaultUserProfile(operatorName) {
  const trimmedName = operatorName?.trim() ?? '';
  const fallback = localOperatorProfiles.find((profile) => profile.operatorName === trimmedName);
  const uid = createLocalUserId(trimmedName);

  return {
    uid,
    operatorName: trimmedName,
    displayName: trimmedName,
    email: null,
    role: fallback?.role ?? roles.operador,
    tenantId: DEFAULT_TENANT_ID,
    storeIds: [DEFAULT_STORE_ID],
    defaultStoreId: DEFAULT_STORE_ID,
    status: 'active',
    authMode: 'local',
  };
}

export function getOperatorOptions() {
  return localOperatorProfiles.map((profile) => profile.operatorName);
}

export async function resolveUserProfileByOperator(operatorName) {
  const fallback = getDefaultUserProfile(operatorName);

  if (!firebaseReady || !firebaseDb) {
    return fallback;
  }

  const userRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.users, fallback.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      ...fallback,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return fallback;
  }

  const profileData = snapshot.data();

  return {
    ...fallback,
    ...profileData,
    uid: snapshot.id,
    operatorName: profileData.operatorName ?? fallback.operatorName,
    displayName: profileData.displayName ?? fallback.displayName,
    role: normalizeRole(profileData.role ?? fallback.role),
    tenantId: profileData.tenantId ?? fallback.tenantId,
    storeIds: Array.isArray(profileData.storeIds) && profileData.storeIds.length > 0
      ? profileData.storeIds
      : fallback.storeIds,
    defaultStoreId: profileData.defaultStoreId
      ?? (Array.isArray(profileData.storeIds) && profileData.storeIds[0])
      ?? fallback.defaultStoreId,
    status: profileData.status ?? fallback.status,
  };
}

export async function refreshSessionProfile(session) {
  if (!session?.operatorName) {
    return session;
  }

  return resolveUserProfileByOperator(session.operatorName);
}
