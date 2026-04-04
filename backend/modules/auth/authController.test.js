import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RequestValidationError } from '../../errors/RequestValidationError.js'

const firestoreSetMock = vi.fn()
const firestoreGetMock = vi.fn()
const createCustomTokenMock = vi.fn()
const getLocalOperatorProfileMock = vi.fn()
const cacheGetMock = vi.fn()
const cacheSetMock = vi.fn()

vi.mock('../../firebaseAdmin.js', () => ({
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

function createSnapshot(data = {}) {
  return {
    data: () => data,
  }
}

vi.mock('../../config/env.js', () => ({
  backendEnv: {
    redisSessionTtlSeconds: 300,
  },
}))

vi.mock('../../config/localOperators.js', () => ({
  getLocalOperatorProfile: getLocalOperatorProfileMock,
  localOperatorProfiles: [
    { operatorName: 'Gabriel', role: 'admin' },
    { operatorName: 'Maria Eduarda', role: 'gerente' },
  ],
}))

vi.mock('../../cache/cacheService.js', () => ({
  buildCacheKey: vi.fn(() => 'nexus10:session:profile:local-gabriel'),
  cacheGet: cacheGetMock,
  cacheSet: cacheSetMock,
}))

vi.mock('../../middleware/requireAuth.js', () => ({
  requireApiAuth: (_request, _response, next) => next(),
  requireRole: () => (_request, _response, next) => next(),
}))

vi.mock('../../logging/logger.js', async () => {
  const actual = await vi.importActual('../../logging/logger.js')
  return {
    ...actual,
    createLoggerContext: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
    withMethodLogging: vi.fn((_config, handler) => handler),
  }
})

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
  const routeCall = app.post.mock.calls.find(([path]) => path === '/api/auth/session')
  const [, ...handlers] = routeCall
  const response = createResponseMock()

  async function dispatch(index, error) {
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

async function runRegisteredPostRoute(app, path, request) {
  const routeCall = app.post.mock.calls.find(([registeredPath]) => registeredPath === path)
  const [, ...handlers] = routeCall
  const response = createResponseMock()

  async function dispatch(index, error) {
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

async function runRegisteredPutRoute(app, path, request) {
  const routeCall = app.put.mock.calls.find(([registeredPath]) => registeredPath === path)
  const [, ...handlers] = routeCall
  const response = createResponseMock()

  async function dispatch(index, error) {
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

async function runRegisteredGetRoute(app, path, request) {
  const routeCall = app.get.mock.calls.find(([registeredPath]) => registeredPath === path)
  const [, ...handlers] = routeCall
  const response = createResponseMock()

  async function dispatch(index, error) {
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

describe('registerAuthRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cacheGetMock.mockResolvedValue(null)
    cacheSetMock.mockResolvedValue(true)
    firestoreGetMock.mockResolvedValue(createSnapshot())
  })

  it('retorna 400 quando o operador nao e informado', async () => {
    const { registerAuthRoutes } = await import('./authController.ts')
    const app = { get: vi.fn(), post: vi.fn(), put: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredRoute(app, { body: { password: '4321' } })

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

  it('cria sessao autenticada quando os dados forem validos', async () => {
    const profile = {
      uid: 'local-gabriel',
      role: 'admin',
      tenantId: 'hora-dez',
      storeIds: ['hora-dez'],
      defaultStoreId: 'hora-dez',
      operatorName: 'Gabriel',
      displayName: 'Gabriel',
    }

    getLocalOperatorProfileMock.mockReturnValue(profile)
    createCustomTokenMock.mockResolvedValue('custom-token-123')

    const { registerAuthRoutes } = await import('./authController.ts')
    const app = { get: vi.fn(), post: vi.fn(), put: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredRoute(app, { body: { operator: 'Gabriel', pin: '0101' } })

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
    expect(cacheSetMock).toHaveBeenCalledTimes(2)
    expect(response.statusCode).toBe(200)
    expect(response.payload).toEqual({
      data: {
        customToken: 'custom-token-123',
        profile,
      },
    })
  })

  it('retorna 500 quando a criacao da sessao falha', async () => {
    getLocalOperatorProfileMock.mockImplementation(() => {
      throw new Error('Falha ao carregar perfil')
    })

    const { registerAuthRoutes } = await import('./authController.ts')
    const app = { get: vi.fn(), post: vi.fn(), put: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredRoute(app, { body: { operator: 'Gabriel', pin: '0101' } })

    expect(response.statusCode).toBe(500)
    expect(response.payload).toEqual({
      error: 'Falha ao carregar perfil',
    })
  })

  it('atualiza a senha remota do operador', async () => {
    const profile = {
      uid: 'local-gabriel',
      role: 'admin',
      tenantId: 'hora-dez',
      storeIds: ['hora-dez'],
      defaultStoreId: 'hora-dez',
      operatorName: 'Gabriel',
      displayName: 'Gabriel',
    }

    getLocalOperatorProfileMock.mockReturnValue(profile)
    const { registerAuthRoutes } = await import('./authController.ts')
    const app = { get: vi.fn(), post: vi.fn(), put: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredPutRoute(app, '/api/auth/operator-passwords', {
      body: {
        operatorName: 'Gabriel',
        password: '1234',
      },
      validated: {
        body: {
          operatorName: 'Gabriel',
          password: '1234',
        },
      },
      authUser: {
        role: 'admin',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(firestoreSetMock).toHaveBeenCalledTimes(1)
    expect(response.payload.data.operatorName).toBe('Gabriel')
    expect(response.payload.data.hasCustomPassword).toBe(true)
    expect(typeof response.payload.data.updatedAt).toBe('string')
  })

  it('valida o PIN remoto padrao no endpoint dedicado', async () => {
    const { registerAuthRoutes } = await import('./authController.ts')
    const app = { get: vi.fn(), post: vi.fn(), put: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredPostRoute(app, '/api/auth/access-pin/verify', {
      body: { pin: '0101' },
      validated: {
        body: {
          pin: '0101',
        },
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toEqual({
      data: {
        valid: true,
      },
    })
  })

  it('retorna o resumo do PIN remoto para admin', async () => {
    firestoreGetMock.mockResolvedValue(
      createSnapshot({
        accessPin: '2468',
        accessPinUpdatedAt: '2026-04-04T18:00:00.000Z',
      }),
    )
    const { registerAuthRoutes } = await import('./authController.ts')
    const app = { get: vi.fn(), post: vi.fn(), put: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredGetRoute(app, '/api/auth/access-pin', {
      authUser: {
        role: 'admin',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toEqual({
      data: {
        hasCustomPin: true,
        updatedAt: '2026-04-04T18:00:00.000Z',
        maskedPin: '****',
      },
    })
  })
})
