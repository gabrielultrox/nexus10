import crypto from 'node:crypto'

import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { DecodedIdToken } from 'firebase-admin/auth'

import { buildCacheKey, cacheRemember } from '../cache/cacheService.js'
import { backendEnv, hasFirebaseAdminConfig } from '../config/env.js'
import { getAdminApp } from '../firebaseAdmin.js'
import type { AuthenticatedUserContext, UserRole, ValidationSource } from '../types/index.js'

type SupportedRoleAlias = UserRole | 'operator' | 'manager' | 'attendant'
type ScopedRequestSource = Exclude<ValidationSource, 'webhook'>
type RequestRecord = Request & Record<string, unknown>

const rolePermissions: Record<UserRole, Set<string>> = {
  admin: new Set([
    'audit:read',
    'assistant:write',
    'finance:read',
    'finance:write',
    'orders:read',
    'orders:write',
    'sales:read',
    'sales:write',
    'integrations:write',
    'reports:read',
    'settings:write',
  ]),
  gerente: new Set([
    'assistant:write',
    'finance:read',
    'finance:write',
    'orders:read',
    'orders:write',
    'sales:read',
    'sales:write',
    'integrations:write',
    'reports:read',
  ]),
  operador: new Set([
    'assistant:write',
    'orders:read',
    'orders:write',
    'sales:read',
    'finance:read',
    'reports:read',
  ]),
  atendente: new Set(['orders:read', 'orders:write']),
}

function normalizeRole(role: string | null | undefined): UserRole {
  switch (String(role ?? '').trim().toLowerCase() as SupportedRoleAlias) {
    case 'admin':
      return 'admin'
    case 'gerente':
    case 'manager':
      return 'gerente'
    case 'atendente':
    case 'attendant':
      return 'atendente'
    case 'operator':
    case 'operador':
    default:
      return 'operador'
  }
}

function readBearerToken(request: Request): string {
  const headerValue = request.headers.authorization ?? ''
  const [scheme, token] = headerValue.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return ''
  }

  return token.trim()
}

function buildAuthUser(decodedToken: DecodedIdToken): AuthenticatedUserContext {
  return {
    uid: decodedToken.uid,
    email: decodedToken.email ?? null,
    displayName: decodedToken.name ?? null,
    operatorName: decodedToken.operatorName ?? decodedToken.name ?? null,
    role: normalizeRole(decodedToken.role as string | undefined),
    tenantId: decodedToken.tenantId ?? null,
    storeIds: Array.isArray(decodedToken.storeIds) ? decodedToken.storeIds.map(String) : [],
    defaultStoreId: decodedToken.defaultStoreId ?? null,
    isAnonymous: decodedToken.firebase?.sign_in_provider === 'anonymous',
    claims: decodedToken,
  }
}

function respondUnauthorized(response: Response, error: string, statusCode = 401): void {
  response.status(statusCode).json({ error })
}

function readScopedStoreId(request: RequestRecord, source: ScopedRequestSource, field: string): string {
  const validatedSource = request.validated?.[source]

  if (
    validatedSource &&
    typeof validatedSource === 'object' &&
    field in validatedSource &&
    (validatedSource as Record<string, unknown>)[field] != null &&
    (validatedSource as Record<string, unknown>)[field] !== ''
  ) {
    return String((validatedSource as Record<string, unknown>)[field]).trim()
  }

  const rawSource = request[source]

  if (
    rawSource &&
    typeof rawSource === 'object' &&
    field in (rawSource as Record<string, unknown>) &&
    (rawSource as Record<string, unknown>)[field] != null &&
    (rawSource as Record<string, unknown>)[field] !== ''
  ) {
    return String((rawSource as Record<string, unknown>)[field]).trim()
  }

  return ''
}

export const requireApiAuth: RequestHandler = async (
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> => {
  if (!hasFirebaseAdminConfig()) {
    respondUnauthorized(
      response,
      'Autenticacao do backend indisponivel. Configure o Firebase Admin.',
      503,
    )
    return
  }

  const token = readBearerToken(request)

  if (!token) {
    respondUnauthorized(response, 'Sessao expirada ou ausente. Entre novamente no app.')
    return
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const decodedToken = (await cacheRemember({
      key: buildCacheKey('session', 'id-token', tokenHash),
      ttlSeconds: backendEnv.redisSessionTtlSeconds,
      loader: () => getAdminApp().auth().verifyIdToken(token),
    })) as DecodedIdToken

    if (decodedToken.firebase?.sign_in_provider === 'anonymous') {
      respondUnauthorized(response, 'Sessao anonima nao pode acessar a API protegida.')
      return
    }

    request.authUser = buildAuthUser(decodedToken)
    next()
  } catch {
    respondUnauthorized(response, 'Token de autenticacao invalido.')
  }
}

export const requireStoreAccess: RequestHandler = (
  request: Request,
  response: Response,
  next: NextFunction,
): void => {
  const storeId = request.params.storeId ? String(request.params.storeId) : ''
  const storeIds = request.authUser?.storeIds ?? []

  if (!storeId || storeIds.includes(storeId)) {
    next()
    return
  }

  response.status(403).json({
    error: 'Seu perfil nao tem acesso a esta loja.',
  })
}

export function requireScopedStoreAccess(
  options: {
    source?: ScopedRequestSource
    field?: string
    required?: boolean
  } = {},
): RequestHandler {
  const { source = 'params', field = 'storeId', required = true } = options

  return function scopedStoreGuard(request: Request, response: Response, next: NextFunction): void {
    const storeId = readScopedStoreId(request as RequestRecord, source, field)

    if (!storeId) {
      if (required) {
        response.status(400).json({
          error: 'Loja obrigatoria para esta operacao.',
        })
        return
      }

      next()
      return
    }

    const storeIds = request.authUser?.storeIds ?? []

    if (storeIds.includes(storeId)) {
      next()
      return
    }

    response.status(403).json({
      error: 'Seu perfil nao tem acesso a esta loja.',
    })
  }
}

export function requirePermission(permission: string): RequestHandler {
  return function permissionGuard(request: Request, response: Response, next: NextFunction): void {
    const role = normalizeRole(request.authUser?.role)
    const permissions = rolePermissions[role] ?? new Set<string>()

    if (permissions.has(permission)) {
      next()
      return
    }

    response.status(403).json({
      error: 'Seu perfil nao tem permissao para esta acao.',
    })
  }
}

export function requireRole(requiredRole: UserRole): RequestHandler {
  return function roleGuard(request: Request, response: Response, next: NextFunction): void {
    const role = normalizeRole(request.authUser?.role)

    if (role === requiredRole) {
      next()
      return
    }

    response.status(403).json({
      error: 'Seu perfil nao tem permissao para acessar este recurso.',
    })
  }
}
