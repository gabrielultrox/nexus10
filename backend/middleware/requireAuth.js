import { hasFirebaseAdminConfig } from '../config/env.js';
import { getAdminApp } from '../firebaseAdmin.js';

function readBearerToken(request) {
  const headerValue = request.headers.authorization ?? '';
  const [scheme, token] = headerValue.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return '';
  }

  return token.trim();
}

function buildAuthUser(decodedToken) {
  return {
    uid: decodedToken.uid,
    email: decodedToken.email ?? null,
    displayName: decodedToken.name ?? null,
    role: decodedToken.role ?? 'operator',
    isAnonymous: decodedToken.firebase?.sign_in_provider === 'anonymous',
    claims: decodedToken,
  };
}

export async function requireApiAuth(request, response, next) {
  if (!hasFirebaseAdminConfig()) {
    response.status(503).json({
      error: 'Autenticacao do backend indisponivel. Configure o Firebase Admin.',
    });
    return;
  }

  const token = readBearerToken(request);

  if (!token) {
    response.status(401).json({
      error: 'Sessao expirada ou ausente. Entre novamente no app.',
    });
    return;
  }

  try {
    const decodedToken = await getAdminApp().auth().verifyIdToken(token);
    request.authUser = buildAuthUser(decodedToken);
    next();
  } catch {
    response.status(401).json({
      error: 'Token de autenticacao invalido.',
    });
  }
}
