import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RequestValidationError } from '../errors/RequestValidationError.js'

const firestoreSetMock = vi.fn()
const createCustomTokenMock = vi.fn()
const getLocalOperatorProfileMock = vi.fn()
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

async function runRegisteredRoute(app, request) {
  const [, ...handlers] = app.post.mock.calls[0]
  const response = createResponseMock()
  let index = 0

  async function dispatch(error) {
    if (error instanceof RequestValidationError) {
      response.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        source: error.source,
        details: error.details,
      })
      return
    }

    const handler = handlers[index]
    index += 1

    if (!handler) {
      return
    }

    await handler(request, response, dispatch)
  }

  await dispatch()
  return response
}

async function loadAuthController({
  localOperatorPassword = '4321',
  profileOverride,
  createCustomTokenResult = 'custom-token-123',
  createCustomTokenError = null,
} = {}) {
  vi.resetModules()
  firestoreSetMock.mockReset()
  createCustomTokenMock.mockReset()
  getLocalOperatorProfileMock.mockReset()
  cacheSetMock.mockReset()
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
      localOperatorPassword,
      redisSessionTtlSeconds: 300,
    },
  }))

  vi.doMock('../config/localOperators.js', () => ({
    getLocalOperatorProfile: getLocalOperatorProfileMock,
  }))

  vi.doMock('../cache/cacheService.js', () => ({
    buildCacheKey: vi.fn(() => 'nexus10:session:profile:local-gabriel'),
    cacheSet: cacheSetMock,
  }))

  vi.doMock('../logging/logger.js', () => ({
    createLoggerContext: vi.fn(() => authLoggerMock),
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
    const app = { post: vi.fn() }

    registerAuthRoutes(app)

    expect(app.post).toHaveBeenCalledTimes(1)
    expect(app.post.mock.calls[0][0]).toBe('/api/auth/session')
  })

  it('retorna 400 quando o payload falha na validacao', async () => {
    const { registerAuthRoutes } = await loadAuthController()
    const app = { post: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredRoute(app, { body: { pin: '4321' } })

    expect(response.statusCode).toBe(400)
    expect(response.payload).toEqual({
      error: 'Selecione um operador.',
    })
  })

  it('retorna 401 quando o PIN estiver incorreto', async () => {
    const { registerAuthRoutes } = await loadAuthController()
    const app = { post: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredRoute(app, {
      body: { operator: 'Gabriel', pin: '9999' },
      log: authLoggerMock,
    })

    expect(response.statusCode).toBe(401)
    expect(response.payload).toEqual({ error: 'Senha incorreta.' })
    expect(authLoggerMock.warn).toHaveBeenCalled()
  })

  it('retorna 503 quando a senha operacional nao estiver configurada', async () => {
    const { registerAuthRoutes } = await loadAuthController({
      localOperatorPassword: '',
    })
    const app = { post: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredRoute(app, {
      body: { operator: 'Gabriel', pin: '4321' },
      log: authLoggerMock,
    })

    expect(response.statusCode).toBe(503)
    expect(response.payload).toEqual({
      error: 'Senha operacional nao configurada no backend.',
    })
    expect(authLoggerMock.error).toHaveBeenCalled()
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
    const app = { post: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredRoute(app, {
      body: { operator: 'Gabriel', pin: '4321' },
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
    const app = { post: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredRoute(app, {
      body: { operator: 'Gabriel', pin: '4321' },
      log: authLoggerMock,
    })

    expect(response.statusCode).toBe(500)
    expect(response.payload).toEqual({
      error: 'Falha ao assinar token',
    })
    expect(authLoggerMock.error).toHaveBeenCalled()
  })
})
