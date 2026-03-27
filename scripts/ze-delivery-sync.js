import { setTimeout as delay } from 'node:timers/promises'

import cron from 'node-cron'

import { getZeDeliveryConfig, getZeDeliveryCronExpression } from '../backend/config/ze-delivery.js'
import { createZeDeliveryAdapter } from '../backend/integrations/ze-delivery/zeDeliveryAdapter.js'
import { createLoggerContext, serializeError } from '../backend/logging/logger.js'

const syncLogger = createLoggerContext({
  module: 'scripts.ze-delivery-sync',
})

function parseArgs(argv) {
  const args = new Set(argv.slice(2))
  const storeIdFlag = argv.find((entry) => entry.startsWith('--storeId='))

  return {
    once: args.has('--once'),
    headed: args.has('--headed'),
    dryRun: args.has('--dry-run'),
    storeId: storeIdFlag ? storeIdFlag.split('=')[1] : '',
  }
}

async function retryWithBackoff(handler, { maxAttempts, baseDelayMs, onRetry }) {
  let lastError = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await handler(attempt)
    } catch (error) {
      lastError = error

      if (attempt >= maxAttempts) {
        break
      }

      onRetry?.(error, attempt)
      await delay(baseDelayMs * 2 ** (attempt - 1))
    }
  }

  throw lastError
}

async function pushToNexus({ config, storeId, deliveries, dryRun }) {
  return retryWithBackoff(
    async (attempt) => {
      const response = await fetch(
        `${config.urls.nexusApiBaseUrl}/api/integrations/ze-delivery/orders`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Ze-Delivery-Token': config.sync.token,
          },
          body: JSON.stringify({
            storeId,
            dryRun,
            deliveries,
            syncMetadata: {
              runId: `script-${Date.now()}-${storeId}`,
              trigger: 'cron',
              source: 'ze-delivery-sync-script',
              scrapedAt: new Date().toISOString(),
              attempt,
            },
          }),
        },
      )

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        const error = new Error(payload.error ?? `Falha HTTP ${response.status}`)
        error.status = response.status
        error.payload = payload
        throw error
      }

      return payload
    },
    {
      maxAttempts: config.sync.retryMax,
      baseDelayMs: config.sync.retryBaseDelayMs,
      onRetry: (error, attempt) => {
        syncLogger.warn(
          {
            context: 'ze_delivery.sync.retry',
            storeId,
            attempt,
            error: serializeError(error),
          },
          'Retrying Zé Delivery sync payload',
        )
      },
    },
  )
}

async function runSingleCycle({ adapter, config, storeIds, dryRun }) {
  const results = []

  for (const storeId of storeIds) {
    const scrapeResult = await adapter.scrapeDeliveries({
      storeId,
      maxOrders: config.sync.maxOrdersPerRun,
    })

    const syncResult = await pushToNexus({
      config,
      storeId,
      deliveries: scrapeResult.deliveries,
      dryRun,
    })

    results.push({
      storeId,
      scraped: scrapeResult.deliveries.length,
      syncResult,
    })
  }

  return results
}

async function main() {
  const args = parseArgs(process.argv)
  const config = getZeDeliveryConfig()

  if (!config.enabled) {
    throw new Error('ZE_DELIVERY_ENABLED=false. A sincronizacao do Zé Delivery esta desabilitada.')
  }

  const resolvedStoreIds = args.storeId ? [args.storeId] : config.stores

  if (!resolvedStoreIds.length) {
    throw new Error('Configure ZE_DELIVERY_STORE_IDS ou informe --storeId=loja.')
  }

  const adapter = createZeDeliveryAdapter({
    config: {
      ...config,
      browser: {
        ...config.browser,
        headless: args.headed ? false : config.browser.headless,
      },
    },
  })

  const shutdown = async () => {
    await adapter.close().catch(() => {})
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  try {
    if (args.once) {
      const result = await runSingleCycle({
        adapter,
        config,
        storeIds: resolvedStoreIds,
        dryRun: args.dryRun || config.sync.dryRun,
      })
      syncLogger.info(
        {
          context: 'ze_delivery.sync.once',
          stores: resolvedStoreIds,
          result,
        },
        'Zé Delivery sync cycle completed',
      )
      return
    }

    const cronExpression = getZeDeliveryCronExpression(config)
    syncLogger.info(
      {
        context: 'ze_delivery.sync.scheduler_started',
        cronExpression,
        stores: resolvedStoreIds,
      },
      'Zé Delivery scheduler started',
    )

    cron.schedule(cronExpression, async () => {
      try {
        const result = await runSingleCycle({
          adapter,
          config,
          storeIds: resolvedStoreIds,
          dryRun: args.dryRun || config.sync.dryRun,
        })
        syncLogger.info(
          {
            context: 'ze_delivery.sync.cycle',
            result,
          },
          'Zé Delivery sync cycle completed',
        )
      } catch (error) {
        syncLogger.error(
          {
            context: 'ze_delivery.sync.cycle_failed',
            error: serializeError(error),
          },
          'Zé Delivery sync cycle failed',
        )
      }
    })
  } finally {
    if (args.once) {
      await shutdown()
    }
  }
}

main().catch((error) => {
  syncLogger.error(
    {
      context: 'ze_delivery.sync.fatal',
      error: serializeError(error),
    },
    'Zé Delivery sync process failed',
  )
  process.exitCode = 1
})
