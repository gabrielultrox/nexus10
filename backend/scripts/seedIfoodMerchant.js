import { backendEnv } from '../config/env.js'
import { touchIntegrationMerchant } from '../repositories/integrationMerchantRepository.js'

function getArgValue(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : null
}

async function main() {
  const storeId = getArgValue('--store') ?? 'hora-dez'
  const merchantId = getArgValue('--merchant') ?? 'ifood-demo'
  const name = getArgValue('--name') ?? 'iFood Demo Merchant'
  const clientId =
    getArgValue('--client-id') ?? process.env.IFOOD_CLIENT_ID ?? 'replace-with-real-client-id'
  const clientSecret =
    getArgValue('--client-secret') ??
    process.env.IFOOD_CLIENT_SECRET ??
    'replace-with-real-client-secret'
  const webhookSecret =
    getArgValue('--webhook-secret') ??
    backendEnv.ifoodWebhookSecret ??
    'replace-with-real-webhook-secret'
  const webhookUrl =
    getArgValue('--webhook-url') ??
    backendEnv.ifoodWebhookUrl ??
    `http://localhost:${backendEnv.port}/webhooks/ifood/${storeId}/${merchantId}`

  await touchIntegrationMerchant({
    storeId,
    merchantId,
    updates: {
      source: 'ifood',
      merchantId,
      name,
      tenantId: 'hora-dez',
      clientId,
      clientSecret,
      webhookSecret,
      webhookUrl,
      pollingEnabled: true,
      webhookEnabled: true,
      trackingEnabled: true,
      widgetEnabled: false,
      widgetId: '',
      widgetMerchantIds: [],
      status: 'active',
      lastSyncError: null,
    },
  })

  console.log(`Merchant iFood salvo em stores/${storeId}/integration_merchants/${merchantId}`)
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exit(1)
})
