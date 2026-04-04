import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signInAnonymously,
  signInWithCustomToken,
  signOut,
} from 'firebase/auth'

import { assertFirebaseAuthReady, firebaseAuth } from './firebaseAuthRuntime'
import { buildRolePermissionFlags, hasRoleAccess, normalizeRole } from './permissions'

export async function loginWithEmail(email, password) {
  assertFirebaseAuthReady()
  return signInWithEmailAndPassword(firebaseAuth, email, password)
}

export async function loginAnonymously() {
  assertFirebaseAuthReady()
  return signInAnonymously(firebaseAuth)
}

export async function loginWithCustomToken(token) {
  assertFirebaseAuthReady()
  return signInWithCustomToken(firebaseAuth, token)
}

export async function logout() {
  assertFirebaseAuthReady()
  return signOut(firebaseAuth)
}

export async function getUserSession(user) {
  if (!user) {
    return null
  }

  const tokenResult = await user.getIdTokenResult()
  const role = normalizeRole(tokenResult.claims?.role)
  const storeIds = tokenResult.claims?.storeIds ?? []
  const defaultStoreId = tokenResult.claims?.defaultStoreId ?? storeIds[0] ?? null
  const tenantId = tokenResult.claims?.tenantId ?? null

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
  }
}

export function subscribeToAuthChanges(callback) {
  assertFirebaseAuthReady()

  return onIdTokenChanged(firebaseAuth, async (user) => {
    const session = await getUserSession(user)
    callback(session)
  })
}

export function getCurrentUser() {
  assertFirebaseAuthReady()
  return firebaseAuth.currentUser
}

export function userHasRequiredRole(session, requiredRoles = []) {
  return hasRoleAccess(session?.role, requiredRoles)
}
