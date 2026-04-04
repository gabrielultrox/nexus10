import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RequestValidationError } from '../errors/RequestValidationError.js'

const firestoreSetMock = vi.fn()
const firestoreGetMock = vi.fn()
const createCustomTokenMock = vi.fn()
const getLocalOperatorProfileMock = vi.fn()
const cacheGetMock = vi.fn()
const cacheSetMock = vi.fn()
const authLoggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

function createResponseMock() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(data) {
      this.payload = data
      return this
    },
  }
}

function createSnapshot(data = {}) {
  return {
    data: () => data,
  }
}

function isValidationError(error) {
  return (
    error instanceof RequestValidationError ||
    (error &&
      typeof error === 'object' &&
      error.code === 'VALIDATION_ERROR' &&
      typeof error.statusCode === 'number')
  )
}

async function runRegisteredRoute(app, path, request) {
  const routeCall = app.post.mock.calls.find(([registeredPath]) => registeredPath === path)

  if (!routeCall) {
    throw new Error(`Route not registered: ${path}`)
  }

  const [, ...handlers] = routeCall
  const response = createResponseMock()

  async function dispatch(index, error) {
    if (isValidationError(error)) {
      response.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        source: error.source,
        details: error.details,
      })
      return
    }

    const handler = handlers[index]

    if (!handler) {
      return
    }

    let nextPromise = null

    const next = (nextError) => {
      nextPromise = dispatch(index + 1, nextError)
      return nextPromise
    }

    await handler(request, response, next)

    if (nextPromise) {
      await nextPromise
    }
  }

  await dispatch(0)
  return response
}

async function loadAuthController({
  profileOverride,
  createCustomTokenResult = 'custom-token-123',
  createCustomTokenError = null,
} = {}) {
  vi.resetModules()
  firestoreSetMock.mockReset()
  firestoreGetMock.mockReset()
  createCustomTokenMock.mockReset()
  getLocalOperatorProfileMock.mockReset()
  cacheSetMock.mockReset()
  cacheGetMock.mockReset()
  authLoggerMock.info.mockReset()
  authLoggerMock.warn.mockReset()
  authLoggerMock.error.mockReset()

  const defaultProfile = {
    uid: 'local-gabriel',
    role: 'admin',
    tenantId: 'hora-dez',
    storeIds: ['hora-dez'],
    defaultStoreId: 'hora-dez',
    operatorName: 'Gabriel',
    displayName: 'Gabriel',
  }

  getLocalOperatorProfileMock.mockReturnValue(profileOverride ?? defaultProfile)
  cacheSetMock.mockResolvedValue(true)
  cacheGetMock.mockResolvedValue(null)
  firestoreGetMock.mockResolvedValue(createSnapshot())

  if (createCustomTokenError) {
    createCustomTokenMock.mockRejectedValue(createCustomTokenError)
  } else {
    createCustomTokenMock.mockResolvedValue(createCustomTokenResult)
  }

  vi.doMock('../firebaseAdmin.js', () => ({
    getAdminFirestore: vi.fn(() => ({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          set: firestoreSetMock,
          get: firestoreGetMock,
        })),
      })),
    })),
    getAdminApp: vi.fn(() => ({
      auth: vi.fn(() => ({
        createCustomToken: createCustomTokenMock,
      })),
    })),
  }))

  vi.doMock('../config/env.js', () => ({
    backendEnv: {
      redisSessionTtlSeconds: 300,
    },
  }))

  vi.doMock('../config/localOperators.js', () => ({
    getLocalOperatorProfile: getLocalOperatorProfileMock,
    localOperatorProfiles: [
      { operatorName: 'Gabriel', role: 'admin' },
      { operatorName: 'Maria Eduarda', role: 'gerente' },
    ],
  }))

  vi.doMock('../cache/cacheService.js', () => ({
    buildCacheKey: vi.fn(() => 'nexus10:session:profile:local-gabriel'),
    cacheGet: cacheGetMock,
    cacheSet: cacheSetMock,
  }))

  vi.doMock('../logging/logger.js', () => ({
    createLoggerContext: vi.fn(() => authLoggerMock),
    withMethodLogging: vi.fn((_config, handler) => handler),
    serializeError: vi.fn((error) => ({
      type: error?.name ?? 'Error',
      message: error?.message ?? 'Unknown error',
    })),
  }))

  return import('../modules/auth/authController.ts')
}

describe('backend auth session route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registra a rota POST /api/auth/session', async () => {
    const { registerAuthRoutes } = await loadAuthController()
    const app = { get: vi.fn(), post: vi.fn(), put: vi.fn() }

    registerAuthRoutes(app)

    expect(app.post).toHaveBeenCalledTimes(3)
    expect(app.post.mock.calls.map(([path]) => path)).toEqual([
      '/api/auth/login',
      '/api/auth/access-pin/verify',
      '/api/auth/session',
    ])
    expect(app.get.mock.calls.map(([path]) => path)).toEqual([
      '/api/auth/operators',
      '/api/auth/access-pin',
      '/api/auth/operator-passwords',
    ])
    expect(app.put.mock.calls.map(([path]) => path)).toEqual([
      '/api/auth/access-pin',
      '/api/auth/operator-passwords',
    ])
  })

  it('retorna 400 quando o payload falha na validacao', async () => {
    const { registerAuthRoutes } = await loadAuthController()
    const app = { get: vi.fn(), post: vi.fn(), put: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredRoute(app, '/api/auth/session', { body: { pin: '4321' } })

    expect(response.statusCode).toBe(400)
    expect(response.payload).toEqual({
      error: 'Falha de validacao em body.',
      code: 'VALIDATION_ERROR',
      source: 'body',
      details: {
        operator: ['operator e obrigatorio.'],
      },
    })
  })

  it('cria sessao autenticada, persiste perfil e preenche cache', async () => {
    const profile = {
      uid: 'local-gabriel',
      role: 'admin',
      tenantId: 'hora-dez',
      storeIds: ['hora-dez'],
      defaultStoreId: 'hora-dez',
      operatorName: 'Gabriel',
      displayName: 'Gabriel',
    }

    const { registerAuthRoutes } = await loadAuthController({
      profileOverride: profile,
      createCustomTokenResult: 'signed-custom-token',
    })
    const app = { get: vi.fn(), post: vi.fn(), put: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredRoute(app, '/api/auth/session', {
      body: { operator: 'Gabriel', pin: '0101' },
      log: authLoggerMock,
    })

    expect(getLocalOperatorProfileMock).toHaveBeenCalledWith('Gabriel')
    expect(firestoreSetMock).toHaveBeenCalledTimes(1)
    expect(createCustomTokenMock).toHaveBeenCalledWith('local-gabriel', {
      role: 'admin',
      tenantId: 'hora-dez',
      storeIds: ['hora-dez'],
      defaultStoreId: 'hora-dez',
      operatorName: 'Gabriel',
      displayName: 'Gabriel',
    })
    expect(cacheSetMock).toHaveBeenCalledWith(
      'nexus10:session:profile:local-gabriel',
      {
        profile,
        claims: {
          role: 'admin',
          tenantId: 'hora-dez',
          storeIds: ['hora-dez'],
          defaultStoreId: 'hora-dez',
          operatorName: 'Gabriel',
          displayName: 'Gabriel',
        },
      },
      300,
    )
    expect(response.statusCode).toBe(200)
    expect(response.payload).toEqual({
      data: {
        customToken: 'signed-custom-token',
        profile,
      },
    })
  })

  it('retorna 500 quando a criacao do token falha', async () => {
    const { registerAuthRoutes } = await loadAuthController({
      createCustomTokenError: new Error('Falha ao assinar token'),
    })
    const app = { get: vi.fn(), post: vi.fn(), put: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredRoute(app, '/api/auth/session', {
      body: { operator: 'Gabriel', pin: '0101' },
      log: authLoggerMock,
    })

    expect(response.statusCode).toBe(500)
    expect(response.payload).toEqual({
      error: 'Falha ao assinar token',
    })
    expect(authLoggerMock.error).toHaveBeenCalled()
  })

  it('aceita POST /api/auth/login com o mesmo fluxo de autenticacao', async () => {
    const { registerAuthRoutes } = await loadAuthController()
    const app = { get: vi.fn(), post: vi.fn(), put: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredRoute(app, '/api/auth/login', {
      body: { operator: 'Gabriel', pin: '0101' },
      log: authLoggerMock,
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload.data.customToken).toBe('custom-token-123')
  })

  it('valida o PIN remoto padrao pelo endpoint dedicado', async () => {
    const { registerAuthRoutes } = await loadAuthController()
    const app = { get: vi.fn(), post: vi.fn(), put: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredRoute(app, '/api/auth/access-pin/verify', {
      body: { pin: '0101' },
      log: authLoggerMock,
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toEqual({
      data: {
        valid: true,
      },
    })
  })
})
