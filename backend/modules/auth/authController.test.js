import { beforeEach, describe, expect, it, vi } from 'vitest'

const firestoreSetMock = vi.fn()
const createCustomTokenMock = vi.fn()
const getLocalOperatorProfileMock = vi.fn()

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

describe('registerAuthRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 400 quando o operador nao e informado', async () => {
    const { registerAuthRoutes } = await import('./authController.js')
    const app = { post: vi.fn() }

    registerAuthRoutes(app)

    const [, handler] = app.post.mock.calls[0]
    const response = createResponseMock()

    await handler({ body: { password: '4321' } }, response)

    expect(response.statusCode).toBe(400)
    expect(response.payload).toEqual({ error: 'Selecione um operador.' })
  })

  it('retorna 401 quando a senha estiver incorreta', async () => {
    const { registerAuthRoutes } = await import('./authController.js')
    const app = { post: vi.fn() }

    registerAuthRoutes(app)

    const [, handler] = app.post.mock.calls[0]
    const response = createResponseMock()

    await handler({ body: { operatorName: 'Gabriel', password: '9999' } }, response)

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

    const { registerAuthRoutes } = await import('./authController.js')
    const app = { post: vi.fn() }

    registerAuthRoutes(app)

    const [, handler] = app.post.mock.calls[0]
    const response = createResponseMock()

    await handler({ body: { operatorName: 'Gabriel', password: '4321' } }, response)

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

    const { registerAuthRoutes } = await import('./authController.js')
    const app = { post: vi.fn() }

    registerAuthRoutes(app)

    const [, handler] = app.post.mock.calls[0]
    const response = createResponseMock()

    await handler({ body: { operatorName: 'Gabriel', password: '4321' } }, response)

    expect(response.statusCode).toBe(500)
    expect(response.payload).toEqual({
      error: 'Falha ao carregar perfil',
    })
  })
})
