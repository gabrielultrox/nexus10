import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

import {
  firebaseApp,
  firebaseAuth,
  firebaseReady,
  hasFirebaseUserSession,
} from './firebaseAuthRuntime'

const useFirebaseEmulators =
  String(import.meta.env.VITE_FIREBASE_USE_EMULATORS ?? 'false') === 'true'
const firestoreEmulatorHost = String(
  import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST ?? '',
).trim()

let firestoreEmulatorConnected = false

function parseHostPort(value) {
  const [host, portText] = String(value ?? '').split(':')
  const port = Number(portText)

  if (!host || !Number.isFinite(port)) {
    return null
  }

  return { host, port }
}

export const firebaseDb = firebaseApp ? getFirestore(firebaseApp) : null

function connectFirebaseFirestoreEmulator() {
  if (!firebaseReady || !firebaseDb || firestoreEmulatorConnected || !useFirebaseEmulators) {
    return
  }

  const firestoreTarget = parseHostPort(firestoreEmulatorHost)

  if (firestoreTarget) {
    connectFirestoreEmulator(firebaseDb, firestoreTarget.host, firestoreTarget.port)
  }

  firestoreEmulatorConnected = true
}

connectFirebaseFirestoreEmulator()

export function canUseRemoteSync() {
  return Boolean(
    firebaseReady && firebaseApp && firebaseAuth && firebaseDb && hasFirebaseUserSession(),
  )
}

export function getRemoteSyncUnavailableReason() {
  if (!firebaseReady || !firebaseApp || !firebaseAuth || !firebaseDb) {
    return 'Firebase nao configurado. Preencha as variaveis VITE_FIREBASE_* antes de usar Auth ou Firestore.'
  }

  return 'Sincronizacao remota indisponivel nesta sessao. Entre com uma sessao Firebase valida para usar dados em tempo real.'
}

export function createRemoteSyncError() {
  return new Error(getRemoteSyncUnavailableReason())
}

export function assertRemoteSyncReady() {
  if (!canUseRemoteSync()) {
    throw createRemoteSyncError()
  }
}

export function guardRemoteSubscription(startSubscription, { onError, onFallback } = {}) {
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
