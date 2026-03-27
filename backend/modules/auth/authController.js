import { getAdminFirestore, getAdminApp } from '../../firebaseAdmin.js';
import { backendEnv } from '../../config/env.js';
import { getLocalOperatorProfile } from '../../config/localOperators.js';
import { createLoggerContext, serializeError } from '../../logging/logger.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { loginSchema } from '../../validation/schemas.js';

const authLogger = createLoggerContext({ module: 'auth' });

function isValidPassword(password) {
  return Boolean(backendEnv.localOperatorPassword)
    && String(password ?? '') === String(backendEnv.localOperatorPassword);
}

export function registerAuthRoutes(app) {
  app.post('/api/auth/session', validateRequest(loginSchema), async (request, response) => {
    const payload = request.validated?.body ?? {};
    const operatorName = String(payload.operator ?? '').trim();
    const password = String(payload.pin ?? '');
    const log = request.log ?? authLogger;

    if (!operatorName) {
      log.warn({
        context: 'auth.session.create',
        reason: 'missing_operator',
      }, 'Auth session rejected');
      response.status(400).json({ error: 'Selecione um operador.' });
      return;
    }

    if (!backendEnv.localOperatorPassword) {
      log.error({
        context: 'auth.session.create',
        operatorName,
        reason: 'missing_backend_password',
      }, 'Operational password is not configured');
      response.status(503).json({ error: 'Senha operacional nao configurada no backend.' });
      return;
    }

    if (!isValidPassword(password)) {
      log.warn({
        context: 'auth.session.create',
        operatorName,
        reason: 'invalid_password',
      }, 'Auth session rejected');
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

      log.info({
        context: 'auth.session.create',
        operatorName: profile.operatorName,
        role: profile.role,
        tenantId: profile.tenantId,
      }, 'Auth session created');

      response.json({
        data: {
          customToken,
          profile,
        },
      });
    } catch (error) {
      log.error({
        context: 'auth.session.create',
        operatorName,
        error: serializeError(error),
      }, 'Failed to create auth session');
      response.status(500).json({
        error: error.message ?? 'Nao foi possivel abrir a sessao autenticada.',
      });
    }
  });
}
