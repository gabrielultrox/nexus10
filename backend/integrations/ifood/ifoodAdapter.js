import { createLoggerContext, withMethodLogging } from '../../logging/logger.js'

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
    throw new Error('Um fetch compativel e obrigatorio para o adapter do iFood.')
  }

  const resolvedConfig = {
    ...defaultIfoodConfig,
    ...config,
  }

  const adapterLogger = createLoggerContext({
    module: 'integrations.ifood.adapter',
  })

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

  const getAccessToken = withMethodLogging(
    {
      logger: adapterLogger,
      action: 'ifood.get_access_token',
      getStartPayload: ({ clientId }) => ({
        client_id: clientId,
      }),
    },
    async ({ clientId, clientSecret }) =>
      requestJson(`${resolvedConfig.authBaseUrl}/oauth/token`, {
        method: 'POST',
        headers: buildJsonHeaders(),
        body: JSON.stringify({
          grantType: 'client_credentials',
          clientId,
          clientSecret,
        }),
      }),
  )

  const pollEvents = withMethodLogging(
    {
      logger: adapterLogger,
      action: 'ifood.poll_events',
      getStartPayload: () => ({
        endpoint: resolvedConfig.pollingPath,
      }),
    },
    async ({ accessToken }) =>
      requestJson(`${resolvedConfig.merchantBaseUrl}${resolvedConfig.pollingPath}`, {
        method: 'GET',
        headers: buildJsonHeaders(accessToken),
      }),
  )

  const acknowledgeEvents = withMethodLogging(
    {
      logger: adapterLogger,
      action: 'ifood.acknowledge_events',
      getStartPayload: ({ eventIds }) => ({
        event_count: Array.isArray(eventIds) ? eventIds.length : 0,
      }),
    },
    async ({ accessToken, eventIds }) =>
      requestJson(`${resolvedConfig.merchantBaseUrl}${resolvedConfig.acknowledgmentPath}`, {
        method: 'POST',
        headers: buildJsonHeaders(accessToken),
        body: JSON.stringify(eventIds),
      }),
  )

  const getOrderDetails = withMethodLogging(
    {
      logger: adapterLogger,
      action: 'ifood.get_order_details',
      getStartPayload: ({ orderId }) => ({
        order_id: orderId,
      }),
    },
    async ({ accessToken, orderId }) =>
      requestJson(
        `${resolvedConfig.merchantBaseUrl}${resolvedConfig.orderDetailsPath}/${encodeURIComponent(orderId)}`,
        {
          method: 'GET',
          headers: buildJsonHeaders(accessToken),
        },
      ),
  )

  return {
    config: resolvedConfig,
    getAccessToken,
    pollEvents,
    acknowledgeEvents,
    getOrderDetails,
  }
}
