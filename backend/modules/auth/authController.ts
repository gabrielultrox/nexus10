import type { Express, Request, Response } from 'express'

import { getAdminFirestore, getAdminApp } from '../../firebaseAdmin.js'
import { backendEnv } from '../../config/env.js'
import { getLocalOperatorProfile, localOperatorProfiles } from '../../config/localOperators.js'
import { buildCacheKey, cacheSet } from '../../cache/cacheService.js'
import { createLoggerContext, serializeError, withMethodLogging } from '../../logging/logger.js'
import { validateRequest } from '../../middleware/validateRequest.js'
import { authLoginSchema, authSessionRouteSchema } from '../../validation/schemas.js'
import type {
  AuthSessionClaims,
  AuthSessionRequestBody,
  AuthSessionResponseBody,
  AuthTokenSessionRequestBody,
  AuthTokenSessionResponseBody,
  ErrorResponseBody,
  LocalOperatorProfile,
} from '../../types/auth.js'

const authLogger = createLoggerContext({ module: 'auth' })

function isValidPassword(password: string): boolean {
  return (
    Boolean(backendEnv.localOperatorPassword) &&
    String(password ?? '') === String(backendEnv.localOperatorPassword)
  )
}

function isTokenSessionPayload(
  payload: AuthSessionRequestBody | AuthTokenSessionRequestBody,
): payload is AuthTokenSessionRequestBody {
  return 'token' in payload
}

async function createLoginSession(payload: AuthSessionRequestBody) {
  const profile = getLocalOperatorProfile(String(payload.operator).trim()) as LocalOperatorProfile
  const firestore = getAdminFirestore()

  await firestore
    .collection('users')
    .doc(profile.uid)
    .set(
      {
        ...profile,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    )

  const customClaims: AuthSessionClaims = {
    role: profile.role,
    tenantId: profile.tenantId,
    storeIds: profile.storeIds,
    defaultStoreId: profile.defaultStoreId,
    operatorName: profile.operatorName,
    displayName: profile.displayName,
  }

  const customToken = await getAdminApp().auth().createCustomToken(profile.uid, customClaims)
  const sessionPayload = {
    profile,
    claims: customClaims,
  }

  await cacheSet(
    buildCacheKey('session', 'profile', profile.uid),
    sessionPayload,
    backendEnv.redisSessionTtlSeconds,
  )

  return {
    customToken,
    profile,
  }
}

async function resolveTokenSession(token: string) {
  const decodedToken = await getAdminApp().auth().verifyIdToken(token)

  return {
    uid: decodedToken.uid,
    role: String(decodedToken.role ?? 'operator'),
    tenantId: decodedToken.tenantId ?? null,
    storeIds: Array.isArray(decodedToken.storeIds) ? decodedToken.storeIds : [],
    defaultStoreId: decodedToken.defaultStoreId ?? null,
    operatorName: decodedToken.operatorName ?? decodedToken.name ?? null,
    displayName: decodedToken.displayName ?? decodedToken.name ?? null,
    email: decodedToken.email ?? null,
  }
}

async function handleCreateLoginSession(
  request: Request,
  response: Response<AuthSessionResponseBody | ErrorResponseBody>,
) {
  const payload = request.validated?.body as AuthSessionRequestBody
  const operatorName = String(payload.operator ?? '').trim()
  const password = String(payload.pin ?? '')
  const log = request.log ?? authLogger
  const createSession = withMethodLogging(
    {
      logger: log as any,
      action: 'auth.session.create',
      getStartPayload: () => ({
        operator_name: operatorName,
      }),
      getSuccessPayload: (result: { customToken: string; profile: LocalOperatorProfile }) => ({
        operator_name: result.profile.operatorName,
        user_id: result.profile.uid,
        role: result.profile.role,
      }),
    },
    () => createLoginSession(payload),
  )

  if (!operatorName) {
    log.warn(
      {
        context: 'auth.session.create',
        request_id: request.id,
        reason: 'missing_operator',
      },
      'Auth session rejected',
    )
    response.status(400).json({ error: 'Selecione um operador.' })
    return
  }

  if (!backendEnv.localOperatorPassword) {
    log.error(
      {
        context: 'auth.session.create',
        request_id: request.id,
        operatorName,
        reason: 'missing_backend_password',
      },
      'Operational password is not configured',
    )
    response.status(503).json({ error: 'Senha operacional nao configurada no backend.' })
    return
  }

  if (!isValidPassword(password)) {
    log.warn(
      {
        context: 'auth.session.create',
        request_id: request.id,
        operatorName,
        reason: 'invalid_password',
      },
      'Auth session rejected',
    )
    response.status(401).json({ error: 'Senha incorreta.' })
    return
  }

  try {
    const session = await createSession()

    response.json({
      data: {
        customToken: session.customToken,
        profile: session.profile,
      },
    })
  } catch (error) {
    log.error(
      {
        context: 'auth.session.create',
        request_id: request.id,
        operatorName,
        error: serializeError(error),
      },
      'Failed to create auth session',
    )
    response.status(500).json({
      error:
        error instanceof Error ? error.message : 'Nao foi possivel abrir a sessao autenticada.',
    })
  }
}

async function handleResolveTokenSession(
  request: Request,
  response: Response<AuthTokenSessionResponseBody | ErrorResponseBody>,
) {
  const payload = request.validated?.body as AuthTokenSessionRequestBody
  const log = request.log ?? authLogger

  try {
    const session = await withMethodLogging(
      {
        logger: log as any,
        action: 'auth.session.resolve',
        getStartPayload: () => ({
          mode: 'token',
        }),
        getSuccessPayload: (result: {
          uid: string
          role: string
          tenantId: string | null
          storeIds: string[]
          defaultStoreId: string | null
          operatorName: string | null
          displayName: string | null
          email: string | null
        }) => ({
          user_id: result.uid,
          role: result.role,
        }),
      },
      () => resolveTokenSession(payload.token),
    )()

    response.json({
      data: {
        session,
      },
    })
  } catch (error) {
    log.error(
      {
        context: 'auth.session.resolve',
        request_id: request.id,
        error: serializeError(error),
      },
      'Failed to resolve auth session',
    )
    response.status(401).json({
      error: error instanceof Error ? error.message : 'Nao foi possivel validar a sessao.',
    })
  }
}

export function registerAuthRoutes(app: Express): void {
  app.get('/api/auth/operators', async (request: Request, response: Response) => {
    const log = request.log ?? authLogger

    const listOperators = withMethodLogging(
      {
        logger: log as any,
        action: 'auth.operators.list',
        getStartPayload: () => ({}),
        getSuccessPayload: (result: Array<{ operatorName: string; role: string }>) => ({
          operators_count: Array.isArray(result) ? result.length : 0,
        }),
      },
      async () =>
        localOperatorProfiles.map((profile) => ({
          operatorName: profile.operatorName,
          role: profile.role,
        })),
    )

    try {
      const operators = await listOperators()
      response.json({
        data: operators,
      })
    } catch (error) {
      log.error(
        {
          context: 'auth.operators.list',
          error: serializeError(error),
        },
        'Failed to list auth operators',
      )
      response.status(500).json({
        error: 'Nao foi possivel listar os operadores.',
      })
    }
  })

  app.post('/api/auth/login', validateRequest(authLoginSchema), handleCreateLoginSession)

  app.post(
    '/api/auth/session',
    validateRequest(authSessionRouteSchema),
    async (request: Request, response: Response) => {
      const payload = request.validated?.body as
        | AuthSessionRequestBody
        | AuthTokenSessionRequestBody
        | undefined

      if (!payload) {
        response.status(400).json({ error: 'Dados de sessao invalidos.' })
        return
      }

      if (isTokenSessionPayload(payload)) {
        await handleResolveTokenSession(request, response)
        return
      }

      await handleCreateLoginSession(
        request,
        response as Response<AuthSessionResponseBody | ErrorResponseBody>,
      )
    },
  )
}
