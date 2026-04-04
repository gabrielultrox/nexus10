import { describe, expect, it, vi } from 'vitest'

import { RequestValidationError } from '../errors/RequestValidationError.js'
import { validateRequest, validateRequestSources } from '../middleware/validateRequest.js'
import {
  authLoginSchema,
  authSessionRouteSchema,
  authSessionSchema,
  createFinancialClosureSchema,
  createFinancialTransactionSchema,
  createOrderSchema,
  updateOrderSchema,
} from '../schemas/validation.js'

function createMiddlewareHarness() {
  const response = {}
  const next = vi.fn()

  return {
    response,
    next,
  }
}

describe('backend validation schemas', () => {
  it('aceita login com pin, operador e storeId', () => {
    const result = authLoginSchema.parse({
      pin: '1234',
      operator: 'Gabriel',
      storeId: 'store-1',
    })

    expect(result).toEqual({
      mode: 'login',
      pin: '1234',
      operator: 'Gabriel',
      storeId: 'store-1',
    })
  })

  it('aceita alias password/operatorName no login', () => {
    const result = authLoginSchema.parse({
      password: '4321',
      operatorName: 'Maria',
    })

    expect(result).toEqual({
      mode: 'login',
      pin: '4321',
      operator: 'Maria',
      storeId: null,
    })
  })

  it('rejeita login sem pin', () => {
    const result = authLoginSchema.safeParse({
      operator: 'Gabriel',
    })

    expect(result.success).toBe(false)
    expect(result.error.flatten().fieldErrors.pin).toContain('PIN e obrigatorio.')
  })

  it('rejeita login sem operador', () => {
    const result = authLoginSchema.safeParse({
      pin: '1234',
    })

    expect(result.success).toBe(false)
    expect(result.error.flatten().fieldErrors.operator).toContain('operator e obrigatorio.')
  })

  it('rejeita login com pin fora do formato', () => {
    const result = authLoginSchema.safeParse({
      pin: '12ab',
      operator: 'Gabriel',
    })

    expect(result.success).toBe(false)
    expect(result.error.flatten().fieldErrors.pin).toContain('PIN deve conter entre 4 e 6 digitos.')
  })

  it('aceita sessao por token', () => {
    const result = authSessionSchema.parse({
      token: 'jwt-token-valido',
    })

    expect(result).toEqual({
      token: 'jwt-token-valido',
    })
  })

  it('aceita schema combinado de sessao via token', () => {
    const result = authSessionRouteSchema.parse({
      token: 'jwt-token-valido',
    })

    expect(result).toEqual({
      token: 'jwt-token-valido',
    })
  })

  it('aceita criacao de ordem com merchant string', () => {
    const result = createOrderSchema.parse({
      orderId: 'ORDER-1',
      merchant: 'external',
      date: '2026-03-27T10:00:00.000Z',
      items: [{ productId: 'p1', quantity: 2, price: 25 }],
    })

    expect(result.orderId).toBe('ORDER-1')
    expect(result.merchant).toBe('external')
    expect(result.items).toHaveLength(1)
  })

  it('aceita criacao de ordem com merchant objeto e code/source', () => {
    const result = createOrderSchema.parse({
      code: 'ORDER-2',
      source: 'external',
      merchant: { id: 'merchant-1', name: 'Loja Centro' },
      date: '2026-03-27T10:00:00.000Z',
      items: [{ productId: 'p1', quantity: 1, unitPrice: 30 }],
    })

    expect(result.orderId).toBe('ORDER-2')
    expect(result.raw.code).toBe('ORDER-2')
    expect(result.merchant).toEqual({ id: 'merchant-1', name: 'Loja Centro' })
  })

  it('rejeita ordem sem identificador', () => {
    const result = createOrderSchema.safeParse({
      merchant: 'external',
      date: '2026-03-27T10:00:00.000Z',
      items: [{ productId: 'p1', quantity: 2, price: 25 }],
    })

    expect(result.success).toBe(false)
    expect(result.error.flatten().fieldErrors.orderId).toContain('orderId e obrigatorio.')
  })

  it('rejeita ordem sem merchant', () => {
    const result = createOrderSchema.safeParse({
      orderId: 'ORDER-3',
      date: '2026-03-27T10:00:00.000Z',
      items: [{ productId: 'p1', quantity: 2, price: 25 }],
    })

    expect(result.success).toBe(false)
    expect(result.error.flatten().fieldErrors.merchant).toContain('merchant e obrigatorio.')
  })

  it('rejeita ordem sem itens', () => {
    const result = createOrderSchema.safeParse({
      orderId: 'ORDER-4',
      merchant: 'external',
      date: '2026-03-27T10:00:00.000Z',
      items: [],
    })

    expect(result.success).toBe(false)
    expect(result.error.flatten().fieldErrors.items).toContain('A ordem deve ter ao menos um item.')
  })

  it('rejeita item sem price ou unitPrice', () => {
    const result = createOrderSchema.safeParse({
      orderId: 'ORDER-5',
      merchant: 'external',
      date: '2026-03-27T10:00:00.000Z',
      items: [{ productId: 'p1', quantity: 1 }],
    })

    expect(result.success).toBe(false)
    expect(
      result.error.issues.some(
        (issue) =>
          issue.path.join('.') === 'items.0.price' &&
          issue.message === 'Informe price ou unitPrice no item.',
      ),
    ).toBe(true)
  })

  it('aceita atualizacao de ordem com status', () => {
    const result = updateOrderSchema.parse({
      status: 'READY',
    })

    expect(result).toEqual({
      status: 'READY',
    })
  })

  it('aceita atualizacao de ordem com updates parciais', () => {
    const result = updateOrderSchema.parse({
      updates: {
        notes: 'Cliente pediu sem cebola',
      },
    })

    expect(result.updates.notes).toBe('Cliente pediu sem cebola')
  })

  it('rejeita atualizacao de ordem vazia', () => {
    const result = updateOrderSchema.safeParse({})

    expect(result.success).toBe(false)
    expect(result.error.flatten().fieldErrors.status).toContain('Informe status ou updates.')
  })

  it('aceita entrada financeira valida', () => {
    const result = createFinancialTransactionSchema.parse({
      type: 'estorno',
      amount: 52.9,
      description: 'Estorno referente ao pedido 123',
      date: '2026-03-27T12:00:00.000Z',
    })

    expect(result.amount).toBe(52.9)
    expect(result.type).toBe('estorno')
  })

  it('rejeita entrada financeira com valor negativo', () => {
    const result = createFinancialTransactionSchema.safeParse({
      type: 'saida',
      amount: -10,
      description: 'Ajuste',
      date: '2026-03-27T12:00:00.000Z',
    })

    expect(result.success).toBe(false)
    expect(result.error.flatten().fieldErrors.amount).toContain('amount deve ser maior que zero.')
  })

  it('rejeita entrada financeira com data invalida', () => {
    const result = createFinancialTransactionSchema.safeParse({
      type: 'pendencia',
      amount: 20,
      description: 'Troco pendente',
      date: '27/03/2026',
    })

    expect(result.success).toBe(false)
    expect(result.error.flatten().fieldErrors.date).toContain(
      'date deve estar em formato ISO valido.',
    )
  })

  it('aceita fechamento financeiro com ids simples', () => {
    const result = createFinancialClosureSchema.parse({
      entries: ['entry-1', 'entry-2'],
      closedAt: '2026-03-27T12:30:00.000Z',
    })

    expect(result.entries).toEqual(['entry-1', 'entry-2'])
  })

  it('aceita fechamento financeiro com objetos de entrada', () => {
    const result = createFinancialClosureSchema.parse({
      entries: [{ entryId: 'entry-1', amount: 50 }],
      closedAt: '2026-03-27T12:30:00.000Z',
    })

    expect(result.entries[0]).toEqual({ entryId: 'entry-1', amount: 50 })
  })

  it('rejeita fechamento financeiro sem entries', () => {
    const result = createFinancialClosureSchema.safeParse({
      entries: [],
      closedAt: '2026-03-27T12:30:00.000Z',
    })

    expect(result.success).toBe(false)
    expect(result.error.flatten().fieldErrors.entries).toContain(
      'A baixa financeira deve conter ao menos uma entrada.',
    )
  })
})

describe('backend validation middleware', () => {
  it('anexa body validado em request.validated', () => {
    const middleware = validateRequest(authLoginSchema)
    const request = {
      body: {
        pin: '1234',
        operator: 'Gabriel',
      },
    }
    const { response, next } = createMiddlewareHarness()

    middleware(request, response, next)

    expect(next).toHaveBeenCalledWith()
    expect(request.validated.body).toEqual({
      mode: 'login',
      pin: '1234',
      operator: 'Gabriel',
      storeId: null,
    })
  })

  it('encaminha RequestValidationError quando body falha', () => {
    const middleware = validateRequest(authLoginSchema)
    const request = {
      body: {
        pin: '12',
      },
    }
    const { response, next } = createMiddlewareHarness()

    middleware(request, response, next)

    const [error] = next.mock.calls[0]
    expect(error).toBeInstanceOf(RequestValidationError)
    expect(error.message).toBe('Falha de validacao em body.')
    expect(error.details.operator).toContain('operator e obrigatorio.')
  })

  it('permite validar params com mapRequest', () => {
    const middleware = validateRequest(updateOrderSchema, {
      source: 'params',
      targetKey: 'params',
      mapRequest: () => ({ status: 'DELIVERED' }),
    })
    const request = {
      params: {
        id: 'order-1',
      },
    }
    const { response, next } = createMiddlewareHarness()

    middleware(request, response, next)

    expect(next).toHaveBeenCalledWith()
    expect(request.validated.params).toEqual({ status: 'DELIVERED' })
  })

  it('valida body e params no mesmo request', () => {
    const middleware = validateRequestSources({
      body: createFinancialTransactionSchema,
      params: {
        schema: authSessionSchema,
        source: 'params',
        mapRequest: (request) => ({ token: request.params.token }),
      },
    })
    const request = {
      body: {
        type: 'entrada',
        amount: 12.5,
        description: 'Recebimento em dinheiro',
        date: '2026-03-27T12:00:00.000Z',
      },
      params: {
        token: 'jwt-token',
      },
    }
    const { response, next } = createMiddlewareHarness()

    middleware(request, response, next)

    expect(next).toHaveBeenCalledWith()
    expect(request.validated.body.amount).toBe(12.5)
    expect(request.validated.params.token).toBe('jwt-token')
  })

  it('interrompe em validateRequestSources quando qualquer source falha', () => {
    const middleware = validateRequestSources({
      body: createFinancialTransactionSchema,
      params: {
        schema: authSessionSchema,
        source: 'params',
        mapRequest: () => ({ token: '' }),
      },
    })
    const request = {
      body: {
        type: 'entrada',
        amount: 12.5,
        description: 'Recebimento em dinheiro',
        date: '2026-03-27T12:00:00.000Z',
      },
      params: {},
    }
    const { response, next } = createMiddlewareHarness()

    middleware(request, response, next)

    const [error] = next.mock.calls[0]
    expect(error).toBeInstanceOf(RequestValidationError)
    expect(error.source).toBe('params')
    expect(error.details.token).toContain('token e obrigatorio.')
  })
})
