import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function hasFirebaseConfig(config) {
  return ['apiKey', 'projectId'].every(
    (field) => typeof config[field] === 'string' && config[field].length > 0,
  );
}

const firebaseReady = hasFirebaseConfig(firebaseConfig);
const firebaseApp = firebaseReady ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;
const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
const firebaseDb = firebaseApp ? getFirestore(firebaseApp) : null;

let authReadyPromise = null;

function assertFirebaseReady() {
  if (!firebaseReady || !firebaseApp || !firebaseAuth || !firebaseDb) {
    throw new Error(
      'Firebase não configurado. Preencha as variáveis VITE_FIREBASE_* antes de usar Auth ou Firestore.',
    );
  }
}

function hasFirebaseUserSession() {
  return Boolean(firebaseAuth?.currentUser);
}

function waitForFirebaseAuthReady() {
  if (!firebaseAuth) {
    return Promise.resolve(null);
  }

  if (firebaseAuth.currentUser) {
    return Promise.resolve(firebaseAuth.currentUser);
  }

  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        unsubscribe();
        authReadyPromise = null;
        resolve(user);
      }, () => {
        authReadyPromise = null;
        resolve(null);
      });
    });
  }

  return authReadyPromise;
}

async function ensureRemoteSession() {
  if (!firebaseAuth) {
    return null;
  }

  const currentUser = firebaseAuth.currentUser ?? await waitForFirebaseAuthReady();

  if (currentUser) {
    return currentUser;
  }

  const credential = await signInAnonymously(firebaseAuth);
  return credential.user;
}

async function clearRemoteSession() {
  if (!firebaseAuth?.currentUser) {
    return;
  }

  await firebaseSignOut(firebaseAuth);
}

function canUseRemoteSync() {
  return Boolean(firebaseReady && firebaseApp && firebaseAuth && firebaseDb && hasFirebaseUserSession());
}

function getRemoteSyncUnavailableReason() {
  if (!firebaseReady || !firebaseApp || !firebaseAuth || !firebaseDb) {
    return 'Firebase nao configurado. Preencha as variaveis VITE_FIREBASE_* antes de usar Auth ou Firestore.';
  }

  return 'Sincronizacao remota indisponivel nesta sessao. Entre com uma sessao Firebase valida para usar dados em tempo real.';
}

function createRemoteSyncError() {
  return new Error(getRemoteSyncUnavailableReason());
}

function assertRemoteSyncReady() {
  if (!canUseRemoteSync()) {
    throw createRemoteSyncError();
  }
}

function guardRemoteSubscription(startSubscription, { onError, onFallback } = {}) {
  if (!canUseRemoteSync()) {
    onFallback?.();
    return () => {};
  }

  try {
    return startSubscription();
  } catch (error) {
    onFallback?.();
    onError?.(error);
    return () => {};
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
};
