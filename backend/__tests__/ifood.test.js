import { describe, expect, it, vi } from 'vitest'

import { createIfoodAdapter } from '../integrations/ifood/ifoodAdapter.js'

function createJsonResponse(body, { ok = true, status = 200, statusText = 'OK' } = {}) {
  return {
    ok,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body),
  }
}

describe('iFood adapter', () => {
  it('exige um fetch compativel para inicializar', () => {
    expect(() => createIfoodAdapter({ fetchImpl: null })).toThrow(/fetch compat/i)
  })

  it('solicita access token com payload e headers corretos', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        accessToken: 'token-123',
        expiresIn: 3600,
      }),
    )
    const adapter = createIfoodAdapter({ fetchImpl: fetchMock })

    const result = await adapter.getAccessToken({
      clientId: 'client-id',
      clientSecret: 'client-secret',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grantType: 'client_credentials',
          clientId: 'client-id',
          clientSecret: 'client-secret',
        }),
      },
    )
    expect(result).toEqual({
      accessToken: 'token-123',
      expiresIn: 3600,
    })
  })

  it('busca eventos de polling com bearer token e config customizada', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        events: [{ id: 'evt-1', code: 'PLC' }],
      }),
    )
    const adapter = createIfoodAdapter({
      fetchImpl: fetchMock,
      config: {
        merchantBaseUrl: 'https://sandbox.ifood.test',
        pollingPath: '/custom/events:polling',
      },
    })

    const result = await adapter.pollEvents({ accessToken: 'bearer-xyz' })

    expect(fetchMock).toHaveBeenCalledWith('https://sandbox.ifood.test/custom/events:polling', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer bearer-xyz',
      },
    })
    expect(result.events).toHaveLength(1)
  })

  it('envia acknowledgment com lista de ids no body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ success: true }))
    const adapter = createIfoodAdapter({ fetchImpl: fetchMock })

    await adapter.acknowledgeEvents({
      accessToken: 'bearer-ack',
      eventIds: ['evt-1', 'evt-2'],
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://merchant-api.ifood.com.br/events/v1.0/events/acknowledgment',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: 'Bearer bearer-ack',
        },
        body: JSON.stringify(['evt-1', 'evt-2']),
      },
    )
  })

  it('codifica o orderId na busca de detalhes do pedido', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        id: 'pedido/123',
        status: 'CONFIRMED',
      }),
    )
    const adapter = createIfoodAdapter({ fetchImpl: fetchMock })

    const result = await adapter.getOrderDetails({
      accessToken: 'bearer-order',
      orderId: 'pedido/123',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://merchant-api.ifood.com.br/order/v1.0/orders/pedido%2F123',
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: 'Bearer bearer-order',
        },
      },
    )
    expect(result.status).toBe('CONFIRMED')
  })

  it('propaga erro HTTP com status e payload da API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse(
        {
          message: 'Nao autorizado',
          details: { reason: 'token_expired' },
        },
        {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        },
      ),
    )
    const adapter = createIfoodAdapter({ fetchImpl: fetchMock })

    await expect(
      adapter.pollEvents({
        accessToken: 'expired-token',
      }),
    ).rejects.toMatchObject({
      message: 'Nao autorizado',
      status: 401,
      payload: {
        message: 'Nao autorizado',
        details: { reason: 'token_expired' },
      },
    })
  })
})
