import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signInAnonymously,
  signInWithCustomToken,
  signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { assertFirebaseReady, firebaseAuth, firebaseDb } from './firebase';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';
import { buildRolePermissionFlags, hasRoleAccess, normalizeRole } from './permissions';

export async function loginWithEmail(email, password) {
  assertFirebaseReady();
  return signInWithEmailAndPassword(firebaseAuth, email, password);
}

export async function loginAnonymously() {
  assertFirebaseReady();
  return signInAnonymously(firebaseAuth);
}

export async function loginWithCustomToken(token) {
  assertFirebaseReady();
  return signInWithCustomToken(firebaseAuth, token);
}

export async function logout() {
  assertFirebaseReady();
  return signOut(firebaseAuth);
}

export async function getUserSession(user) {
  if (!user) {
    return null;
  }

  const tokenResult = await user.getIdTokenResult();
  const role = normalizeRole(tokenResult.claims?.role);
  let profileData = null;

  if (firebaseDb) {
    const userRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.users, user.uid);
    const userSnapshot = await getDoc(userRef);
    profileData = userSnapshot.exists() ? userSnapshot.data() : null;
  }

  const storeIds = profileData?.storeIds ?? tokenResult.claims?.storeIds ?? [];
  const defaultStoreId = profileData?.defaultStoreId ?? tokenResult.claims?.defaultStoreId ?? storeIds[0] ?? null;
  const tenantId = profileData?.tenantId ?? tokenResult.claims?.tenantId ?? null;

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    isAnonymous: user.isAnonymous,
    role,
    tenantId,
    storeIds,
    defaultStoreId,
    claims: tokenResult.claims,
    permissions: buildRolePermissionFlags(role),
  };
}

export function subscribeToAuthChanges(callback) {
  assertFirebaseReady();

  return onIdTokenChanged(firebaseAuth, async (user) => {
    const session = await getUserSession(user);
    callback(session);
  });
}

export function getCurrentUser() {
  assertFirebaseReady();
  return firebaseAuth.currentUser;
}

export function userHasRequiredRole(session, requiredRoles = []) {
  return hasRoleAccess(session?.role, requiredRoles);
}
