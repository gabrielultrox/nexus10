import { hasFirebaseAdminConfig } from '../config/env.js';
import { getAdminApp } from '../firebaseAdmin.js';
import { backendEnv } from '../config/env.js';
import { buildCacheKey, cacheRemember } from '../cache/cacheService.js';
import crypto from 'node:crypto';

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
    operatorName: decodedToken.operatorName ?? decodedToken.name ?? null,
    role: decodedToken.role ?? 'operator',
    tenantId: decodedToken.tenantId ?? null,
    storeIds: Array.isArray(decodedToken.storeIds) ? decodedToken.storeIds : [],
    defaultStoreId: decodedToken.defaultStoreId ?? null,
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
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const decodedToken = await cacheRemember({
      key: buildCacheKey('session', 'id-token', tokenHash),
      ttlSeconds: backendEnv.redisSessionTtlSeconds,
      loader: () => getAdminApp().auth().verifyIdToken(token),
    });

    if (decodedToken.firebase?.sign_in_provider === 'anonymous') {
      response.status(401).json({
        error: 'Sessao anonima nao pode acessar a API protegida.',
      });
      return;
    }
    request.authUser = buildAuthUser(decodedToken);
    next();
  } catch {
    response.status(401).json({
      error: 'Token de autenticacao invalido.',
    });
  }
}

export function requireStoreAccess(request, response, next) {
  const storeId = request.params.storeId;
  const storeIds = request.authUser?.storeIds ?? [];

  if (!storeId || storeIds.includes(storeId)) {
    next();
    return;
  }

  response.status(403).json({
    error: 'Seu perfil nao tem acesso a esta loja.',
  });
}

const rolePermissions = {
  admin: new Set(['assistant:write', 'orders:read', 'orders:write', 'sales:read', 'sales:write', 'integrations:write']),
  gerente: new Set(['assistant:write', 'orders:read', 'orders:write', 'sales:read', 'sales:write', 'integrations:write']),
  operador: new Set(['assistant:write', 'orders:read', 'orders:write', 'sales:read']),
  atendente: new Set(['orders:read', 'orders:write']),
};

export function requirePermission(permission) {
  return function permissionGuard(request, response, next) {
    const role = request.authUser?.role ?? 'operador';
    const permissions = rolePermissions[role] ?? new Set();

    if (permissions.has(permission)) {
      next();
      return;
    }

    response.status(403).json({
      error: 'Seu perfil nao tem permissao para esta acao.',
    });
  };
}

export function requireRole(requiredRole) {
  return function roleGuard(request, response, next) {
    const role = request.authUser?.role ?? 'operador';

    if (role === requiredRole) {
      next();
      return;
    }

    response.status(403).json({
      error: 'Seu perfil nao tem permissao para acessar este recurso.',
    });
  };
}
