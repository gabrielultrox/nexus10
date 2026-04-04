import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export { firebaseConfig }

function hasFirebaseConfig(config) {
  return ['apiKey', 'projectId'].every(
    (field) => typeof config[field] === 'string' && config[field].length > 0,
  )
}

function parseHostPort(value) {
  const [host, portText] = String(value ?? '').split(':')
  const port = Number(portText)

  if (!host || !Number.isFinite(port)) {
    return null
  }

  return { host, port }
}

export const firebaseReady = hasFirebaseConfig(firebaseConfig)
export const firebaseApp = firebaseReady
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null

const useFirebaseEmulators =
  String(import.meta.env.VITE_FIREBASE_USE_EMULATORS ?? 'false') === 'true'
const authEmulatorHost = String(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST ?? '').trim()

let authReadyPromise = null
let authEmulatorConnected = false

function connectFirebaseAuthEmulator() {
  if (!firebaseReady || !firebaseAuth || authEmulatorConnected || !useFirebaseEmulators) {
    return
  }

  const authTarget = parseHostPort(authEmulatorHost)

  if (authTarget) {
    connectAuthEmulator(firebaseAuth, `http://${authTarget.host}:${authTarget.port}`, {
      disableWarnings: true,
    })
  }

  authEmulatorConnected = true
}

connectFirebaseAuthEmulator()

export function assertFirebaseAuthReady() {
  if (!firebaseReady || !firebaseApp || !firebaseAuth) {
    throw new Error(
      'Firebase nao configurado. Preencha as variaveis VITE_FIREBASE_* antes de usar autenticacao remota.',
    )
  }
}

export function hasFirebaseUserSession() {
  return Boolean(firebaseAuth?.currentUser)
}

export function waitForFirebaseAuthReady() {
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

export async function ensureRemoteSession() {
  if (!firebaseAuth) {
    return null
  }

  return firebaseAuth.currentUser ?? (await waitForFirebaseAuthReady())
}

export async function clearRemoteSession() {
  if (!firebaseAuth?.currentUser) {
    return
  }

  await firebaseSignOut(firebaseAuth)
}
