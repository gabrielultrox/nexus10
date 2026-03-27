const defaultIfoodConfig = {
  authBaseUrl: 'https://merchant-api.ifood.com.br/authentication/v1.0',
  merchantBaseUrl: 'https://merchant-api.ifood.com.br',
  pollingPath: '/events/v1.0/events:polling',
  acknowledgmentPath: '/events/v1.0/events/acknowledgment',
  orderDetailsPath: '/order/v1.0/orders',
}

function buildJsonHeaders(accessToken = null) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  return headers
}

export function createIfoodAdapter({ fetchImpl = globalThis.fetch, config = {} } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Um fetch compatível é obrigatório para o adapter do iFood.')
  }

  const resolvedConfig = {
    ...defaultIfoodConfig,
    ...config,
  }

  async function requestJson(url, options = {}) {
    const response = await fetchImpl(url, options)
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const error = new Error(payload?.message ?? payload?.error?.message ?? response.statusText)
      error.status = response.status
      error.payload = payload
      throw error
    }

    return payload
  }

  return {
    config: resolvedConfig,

    async getAccessToken({ clientId, clientSecret }) {
      return requestJson(`${resolvedConfig.authBaseUrl}/oauth/token`, {
        method: 'POST',
        headers: buildJsonHeaders(),
        body: JSON.stringify({
          grantType: 'client_credentials',
          clientId,
          clientSecret,
        }),
      })
    },

    async pollEvents({ accessToken }) {
      return requestJson(`${resolvedConfig.merchantBaseUrl}${resolvedConfig.pollingPath}`, {
        method: 'GET',
        headers: buildJsonHeaders(accessToken),
      })
    },

    async acknowledgeEvents({ accessToken, eventIds }) {
      return requestJson(`${resolvedConfig.merchantBaseUrl}${resolvedConfig.acknowledgmentPath}`, {
        method: 'POST',
        headers: buildJsonHeaders(accessToken),
        body: JSON.stringify(eventIds),
      })
    },

    async getOrderDetails({ accessToken, orderId }) {
      return requestJson(
        `${resolvedConfig.merchantBaseUrl}${resolvedConfig.orderDetailsPath}/${encodeURIComponent(orderId)}`,
        {
          method: 'GET',
          headers: buildJsonHeaders(accessToken),
        },
      )
    },
  }
}
