import admin from 'firebase-admin';

import { backendEnv, hasFirebaseAdminConfig } from './config/env.js';

let firestoreInstance = null;
let adminAppInstance = null;

export function getAdminApp() {
  if (adminAppInstance) {
    return adminAppInstance;
  }

  if (!hasFirebaseAdminConfig()) {
    throw new Error(
      'Firebase Admin nao configurado. Preencha FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL e FIREBASE_ADMIN_PRIVATE_KEY.',
    );
  }

  adminAppInstance = admin.apps.length > 0
    ? admin.app()
    : admin.initializeApp({
      credential: admin.credential.cert({
        projectId: backendEnv.firebaseProjectId,
        clientEmail: backendEnv.firebaseClientEmail,
        privateKey: backendEnv.firebasePrivateKey,
      }),
      projectId: backendEnv.firebaseProjectId,
    });

  return adminAppInstance;
}

export function getAdminFirestore() {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  if (!hasFirebaseAdminConfig()) {
    throw new Error(
      'Firebase Admin nao configurado. Preencha FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL e FIREBASE_ADMIN_PRIVATE_KEY.',
    );
  }

  const app = getAdminApp();

  firestoreInstance = app.firestore();
  return firestoreInstance;
}
