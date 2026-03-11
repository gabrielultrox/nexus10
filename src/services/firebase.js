import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
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

function assertFirebaseReady() {
  if (!firebaseReady || !firebaseApp || !firebaseAuth || !firebaseDb) {
    throw new Error(
      'Firebase não configurado. Preencha as variáveis VITE_FIREBASE_* antes de usar Auth ou Firestore.',
    );
  }
}

export {
  assertFirebaseReady,
  firebaseApp,
  firebaseAuth,
  firebaseConfig,
  firebaseDb,
  firebaseReady,
};
