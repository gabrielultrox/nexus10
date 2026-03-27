import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

function hasFirebaseConfig(config) {
  return ['apiKey', 'projectId'].every(
    (field) => typeof config[field] === 'string' && config[field].length > 0,
  )
}

const firebaseReady = hasFirebaseConfig(firebaseConfig)
const firebaseApp = firebaseReady
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null
const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null
const firebaseDb = firebaseApp ? getFirestore(firebaseApp) : null
const useFirebaseEmulators =
  String(import.meta.env.VITE_FIREBASE_USE_EMULATORS ?? 'false') === 'true'
const firestoreEmulatorHost = String(
  import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST ?? '',
).trim()
const authEmulatorHost = String(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST ?? '').trim()

let authReadyPromise = null
let emulatorsConnected = false

function parseHostPort(value) {
  const [host, portText] = String(value ?? '').split(':')
  const port = Number(portText)

  if (!host || !Number.isFinite(port)) {
    return null
  }

  return { host, port }
}

function connectFirebaseEmulators() {
  if (
    !firebaseReady ||
    !firebaseAuth ||
    !firebaseDb ||
    emulatorsConnected ||
    !useFirebaseEmulators
  ) {
    return
  }

  const firestoreTarget = parseHostPort(firestoreEmulatorHost)
  const authTarget = parseHostPort(authEmulatorHost)

  if (firestoreTarget) {
    connectFirestoreEmulator(firebaseDb, firestoreTarget.host, firestoreTarget.port)
  }

  if (authTarget) {
    connectAuthEmulator(firebaseAuth, `http://${authTarget.host}:${authTarget.port}`, {
      disableWarnings: true,
    })
  }

  emulatorsConnected = true
}

connectFirebaseEmulators()

function assertFirebaseReady() {
  if (!firebaseReady || !firebaseApp || !firebaseAuth || !firebaseDb) {
    throw new Error(
      'Firebase não configurado. Preencha as variáveis VITE_FIREBASE_* antes de usar Auth ou Firestore.',
    )
  }
}

function hasFirebaseUserSession() {
  return Boolean(firebaseAuth?.currentUser)
}

function waitForFirebaseAuthReady() {
  if (!firebaseAuth) {
    return Promise.resolve(null)
  }

  if (firebaseAuth.currentUser) {
    return Promise.resolve(firebaseAuth.currentUser)
  }

  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(
        firebaseAuth,
        (user) => {
          unsubscribe()
          authReadyPromise = null
          resolve(user)
        },
        () => {
          authReadyPromise = null
          resolve(null)
        },
      )
    })
  }

  return authReadyPromise
}

async function ensureRemoteSession() {
  if (!firebaseAuth) {
    return null
  }

  return firebaseAuth.currentUser ?? (await waitForFirebaseAuthReady())
}

async function clearRemoteSession() {
  if (!firebaseAuth?.currentUser) {
    return
  }

  await firebaseSignOut(firebaseAuth)
}

function canUseRemoteSync() {
  return Boolean(
    firebaseReady && firebaseApp && firebaseAuth && firebaseDb && hasFirebaseUserSession(),
  )
}

function getRemoteSyncUnavailableReason() {
  if (!firebaseReady || !firebaseApp || !firebaseAuth || !firebaseDb) {
    return 'Firebase nao configurado. Preencha as variaveis VITE_FIREBASE_* antes de usar Auth ou Firestore.'
  }

  return 'Sincronizacao remota indisponivel nesta sessao. Entre com uma sessao Firebase valida para usar dados em tempo real.'
}

function createRemoteSyncError() {
  return new Error(getRemoteSyncUnavailableReason())
}

function assertRemoteSyncReady() {
  if (!canUseRemoteSync()) {
    throw createRemoteSyncError()
  }
}

function guardRemoteSubscription(startSubscription, { onError, onFallback } = {}) {
  if (!canUseRemoteSync()) {
    onFallback?.()
    return () => {}
  }

  try {
    return startSubscription()
  } catch (error) {
    onFallback?.()
    onError?.(error)
    return () => {}
  }
}

export {
  assertFirebaseReady,
  assertRemoteSyncReady,
  canUseRemoteSync,
  clearRemoteSession,
  createRemoteSyncError,
  ensureRemoteSession,
  firebaseApp,
  firebaseAuth,
  firebaseConfig,
  firebaseDb,
  firebaseReady,
  getRemoteSyncUnavailableReason,
  guardRemoteSubscription,
  hasFirebaseUserSession,
  waitForFirebaseAuthReady,
}
