import { getZeDeliveryConfig } from '../backend/config/ze-delivery.js'
import { createZeDeliveryAdapter } from '../backend/integrations/ze-delivery/zeDeliveryAdapter.js'

async function main() {
  const config = getZeDeliveryConfig()
  const storeId = process.argv.find((value) => value.startsWith('--storeId='))?.split('=')[1]

  if (!storeId) {
    throw new Error('Informe --storeId=<storeId> para testar o scrape do Zé Delivery.')
  }

  const adapter = createZeDeliveryAdapter({
    config: {
      ...config,
      browser: {
        ...config.browser,
        headless: false,
      },
    },
  })

  try {
    const result = await adapter.scrapeDeliveries({
      storeId,
      maxOrders: 10,
    })

    console.log(
      JSON.stringify(
        {
          storeId,
          scrapedAt: result.scrapedAt,
          deliveries: result.deliveries,
        },
        null,
        2,
      ),
    )
  } finally {
    await adapter.close().catch(() => {})
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
