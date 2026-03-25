import { getAdminFirestore, getAdminApp } from '../../firebaseAdmin.js';
import { backendEnv } from '../../config/env.js';
import { getLocalOperatorProfile } from '../../config/localOperators.js';

function isValidPassword(password) {
  return Boolean(backendEnv.localOperatorPassword)
    && String(password ?? '') === String(backendEnv.localOperatorPassword);
}

export function registerAuthRoutes(app) {
  app.post('/api/auth/session', async (request, response) => {
    const operatorName = String(request.body?.operatorName ?? '').trim();
    const password = String(request.body?.password ?? '');

    if (!operatorName) {
      response.status(400).json({ error: 'Selecione um operador.' });
      return;
    }

    if (!backendEnv.localOperatorPassword) {
      response.status(503).json({ error: 'Senha operacional nao configurada no backend.' });
      return;
    }

    if (!isValidPassword(password)) {
      response.status(401).json({ error: 'Senha incorreta.' });
      return;
    }

    try {
      const profile = getLocalOperatorProfile(operatorName);
      const firestore = getAdminFirestore();

      await firestore.collection('users').doc(profile.uid).set({
        ...profile,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      const customClaims = {
        role: profile.role,
        tenantId: profile.tenantId,
        storeIds: profile.storeIds,
        defaultStoreId: profile.defaultStoreId,
        operatorName: profile.operatorName,
        displayName: profile.displayName,
      };

      const customToken = await getAdminApp().auth().createCustomToken(profile.uid, customClaims);

      response.json({
        data: {
          customToken,
          profile,
        },
      });
    } catch (error) {
      response.status(500).json({
        error: error.message ?? 'Nao foi possivel abrir a sessao autenticada.',
      });
    }
  });
}
