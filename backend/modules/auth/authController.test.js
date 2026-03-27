import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RequestValidationError } from '../../errors/RequestValidationError.js'

const firestoreSetMock = vi.fn()
const createCustomTokenMock = vi.fn()
const getLocalOperatorProfileMock = vi.fn()
const cacheSetMock = vi.fn()

vi.mock('../../firebaseAdmin.js', () => ({
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

vi.mock('../../config/env.js', () => ({
  backendEnv: {
    localOperatorPassword: '4321',
  },
}))

vi.mock('../../config/localOperators.js', () => ({
  getLocalOperatorProfile: getLocalOperatorProfileMock,
}))

vi.mock('../../cache/cacheService.js', () => ({
  buildCacheKey: vi.fn(() => 'nexus10:session:profile:local-gabriel'),
  cacheSet: cacheSetMock,
}))

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

describe('registerAuthRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cacheSetMock.mockResolvedValue(true)
  })

  it('retorna 400 quando o operador nao e informado', async () => {
    const { registerAuthRoutes } = await import('./authController.ts')
    const app = { post: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredRoute(app, { body: { password: '4321' } })

    expect(response.statusCode).toBe(400)
    expect(response.payload).toEqual({
      error: 'Dados de entrada invalidos.',
      code: 'VALIDATION_ERROR',
      source: 'body',
      details: {
        operator: ['operator e obrigatorio.'],
      },
    })
  })

  it('retorna 401 quando a senha estiver incorreta', async () => {
    const { registerAuthRoutes } = await import('./authController.ts')
    const app = { post: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredRoute(app, { body: { operator: 'Gabriel', pin: '9999' } })

    expect(response.statusCode).toBe(401)
    expect(response.payload).toEqual({ error: 'Senha incorreta.' })
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
    const app = { post: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredRoute(app, { body: { operator: 'Gabriel', pin: '4321' } })

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
    expect(cacheSetMock).toHaveBeenCalledTimes(1)
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
    const app = { post: vi.fn() }

    registerAuthRoutes(app)

    const response = await runRegisteredRoute(app, { body: { operator: 'Gabriel', pin: '4321' } })

    expect(response.statusCode).toBe(500)
    expect(response.payload).toEqual({
      error: 'Falha ao carregar perfil',
    })
  })
})
