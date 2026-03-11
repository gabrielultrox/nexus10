import admin from 'firebase-admin';

import { backendEnv, hasFirebaseAdminConfig } from './config/env.js';

let firestoreInstance = null;

export function getAdminFirestore() {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  if (!hasFirebaseAdminConfig()) {
    throw new Error(
      'Firebase Admin nao configurado. Preencha FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL e FIREBASE_ADMIN_PRIVATE_KEY.',
    );
  }

  const app = admin.apps.length > 0
    ? admin.app()
    : admin.initializeApp({
      credential: admin.credential.cert({
        projectId: backendEnv.firebaseProjectId,
        clientEmail: backendEnv.firebaseClientEmail,
        privateKey: backendEnv.firebasePrivateKey,
      }),
      projectId: backendEnv.firebaseProjectId,
    });

  firestoreInstance = app.firestore();
  return firestoreInstance;
}
