import { randomUUID } from 'node:crypto'

import { getZeDeliveryConfig } from '../../config/ze-delivery.js'
import { createLoggerContext, serializeError } from '../../logging/logger.js'
import {
  readZeDeliverySchedulerStates,
  summarizeZeDeliverySchedulerStates,
} from '../../middleware/health-check.js'
import { zeDeliveryOrderSchema } from '../../validation/schemas.js'
import { createZeDeliveryOrderRepository } from '../../repositories/zeDeliveryOrderRepository.js'
import { createZeDeliveryAdapter } from './zeDeliveryAdapter.js'

function createHashPayload(delivery) {
  const normalizedLocation = {}

  if (delivery.location?.address) {
    normalizedLocation.address = delivery.location.address
  }

  if (delivery.location?.lat != null) {
    normalizedLocation.lat = delivery.location.lat
  }

  if (delivery.location?.lng != null) {
    normalizedLocation.lng = delivery.location.lng
  }

  return JSON.stringify({
    status: delivery.status,
    timestamp: delivery.timestamp,
    scannedBy: delivery.scannedBy ?? null,
    courierName: delivery.courierName ?? null,
    location: normalizedLocation,
    code: delivery.code,
  })
}

function buildStoreSummary(initial = {}) {
  return {
    created: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    dryRun: false,
    ...initial,
  }
}

function buildDefaultStoreSettings(config) {
  return {
    enabled: config.enabled,
    intervalMinutes: config.sync.intervalMinutes,
    notificationsEnabled: false,
    notificationWebhookUrl: '',
  }
}

function mergeStoreSettings(config, storedSettings = {}) {
  return {
    ...buildDefaultStoreSettings(config),
    ...(storedSettings ?? {}),
  }
}

function sortByCreatedAtDesc(collection = []) {
  return [...collection].sort((left, right) =>
    String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')),
  )
}

function computeStatsFromLogs(logs = []) {
  const totalRuns = logs.length
  const failedRuns = logs.filter((log) => log.summary?.success === false).length
  const syncedDeliveries = logs.reduce(
    (total, log) => total + Number(log.summary?.processed ?? 0),
    0,
  )
  const averageDurationMs =
    totalRuns > 0
      ? Math.round(
          logs.reduce((total, log) => total + Number(log.summary?.durationMs ?? 0), 0) / totalRuns,
        )
      : 0

  return {
    deliveriesSynced: syncedDeliveries,
    errors: failedRuns,
    averageDurationMs,
    failureRate: totalRuns > 0 ? failedRuns / totalRuns : 0,
    totalRuns,
  }
}

export function createZeDeliveryService({
  repository = createZeDeliveryOrderRepository(),
  adapter = createZeDeliveryAdapter(),
  config = getZeDeliveryConfig(),
} = {}) {
  const serviceLogger = createLoggerContext({
    module: 'integrations.ze-delivery.service',
  })

  async function getStoreSettings({ storeId }) {
    const storedSettings = await repository.getStoreSettings({ storeId })
    return mergeStoreSettings(config, storedSettings)
  }

  async function updateStoreSettings({ storeId, settings }) {
    const nextSettings = mergeStoreSettings(config, settings)
    await repository.setStoreSettings({
      storeId,
      settings: nextSettings,
    })

    return nextSettings
  }

  async function ingestScrapedOrders({ storeId, deliveries, dryRun = false, syncMetadata = {} }) {
    const startedAt = Date.now()
    const runId = syncMetadata.runId ?? `ze-delivery-${randomUUID()}`
    const summary = buildStoreSummary({
      dryRun,
      runId,
      storeId,
      processed: deliveries.length,
      startedAt: new Date().toISOString(),
      trigger: syncMetadata.trigger ?? 'script',
    })

    for (const rawDelivery of deliveries) {
      try {
        const normalizedDelivery = zeDeliveryOrderSchema.parse(rawDelivery)
        const payloadHash = createHashPayload(normalizedDelivery)
        const existingOrder = await repository.getOrder({
          storeId,
          zeDeliveryId: normalizedDelivery.zeDeliveryId,
        })

        if (existingOrder?.payloadHash === payloadHash) {
          summary.unchanged += 1
          continue
        }

        if (!dryRun) {
          await repository.upsertOrder({
            storeId,
            order: {
              ...normalizedDelivery,
              storeId,
              payloadHash,
              source: 'ze_delivery',
              syncStatus: 'synced',
              syncedAt: new Date().toISOString(),
              lastRunId: runId,
              errorMessage: null,
            },
          })
        }

        if (existingOrder) {
          summary.updated += 1
        } else {
          summary.created += 1
        }
      } catch (error) {
        summary.failed += 1
        serviceLogger.error(
          {
            context: 'ze_delivery.ingest.delivery_failed',
            storeId,
            runId,
            deliveryId: rawDelivery?.zeDeliveryId ?? null,
            error: serializeError(error),
          },
          'Failed to ingest Zé Delivery entry',
        )
      }
    }

    summary.completedAt = new Date().toISOString()
    summary.durationMs = Date.now() - startedAt
    summary.success = summary.failed === 0

    if (!dryRun) {
      await repository.appendSyncLog({
        storeId,
        log: {
          runId,
          source: 'ze_delivery',
          createdAt: summary.completedAt,
          trigger: summary.trigger,
          summary,
        },
      })

      await repository.setStoreStatus({
        storeId,
        status: {
          enabled: config.enabled,
          lastRunId: runId,
          lastSyncAt: summary.completedAt,
          lastSyncSuccess: summary.success,
          lastSyncError:
            summary.failed > 0 ? 'Uma ou mais entregas falharam ao sincronizar.' : null,
          counters: {
            created: summary.created,
            updated: summary.updated,
            unchanged: summary.unchanged,
            failed: summary.failed,
          },
        },
      })
    }

    return summary
  }

  async function runScrapeAndSync({ storeId, dryRun = config.sync.dryRun, maxOrders }) {
    const scrapeResult = await adapter.scrapeDeliveries({
      storeId,
      maxOrders,
    })

    return ingestScrapedOrders({
      storeId,
      deliveries: scrapeResult.deliveries,
      dryRun,
      syncMetadata: {
        runId: `manual-${randomUUID()}`,
        trigger: 'backend',
        scrapedAt: scrapeResult.scrapedAt,
      },
    })
  }

  async function retrySync({ storeId, zeDeliveryId, dryRun = false }) {
    const scrapeResult = await adapter.scrapeDeliveries({
      storeId,
      maxOrders: config.sync.maxOrdersPerRun,
    })
    const matchingDelivery = scrapeResult.deliveries.find(
      (delivery) => delivery.zeDeliveryId === zeDeliveryId || delivery.code === zeDeliveryId,
    )

    if (!matchingDelivery) {
      throw new Error('Entrega do Zé Delivery nao encontrada no scrape atual.')
    }

    return ingestScrapedOrders({
      storeId,
      deliveries: [matchingDelivery],
      dryRun,
      syncMetadata: {
        runId: `retry-${randomUUID()}`,
        trigger: 'retry',
        scrapedAt: scrapeResult.scrapedAt,
      },
    })
  }

  async function getStatus({ storeIds, storeId = '', limit = 20 }) {
    const resolvedStoreIds = storeId ? [storeId] : storeIds
    const statuses = await repository.listStoreStatuses({
      storeIds: resolvedStoreIds,
    })

    return Promise.all(
      statuses.map(async ({ storeId: currentStoreId, status }) => {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const [settings, recentOrders, recentLogs, logs24h] = await Promise.all([
          getStoreSettings({ storeId: currentStoreId }),
          repository.listOrders({
            storeId: currentStoreId,
            limit,
          }),
          repository.listSyncLogs({
            storeId: currentStoreId,
            limit,
          }),
          repository.listSyncLogs({
            storeId: currentStoreId,
            limit: 200,
            since,
          }),
        ])

        return {
          storeId: currentStoreId,
          status,
          settings,
          recentOrders,
          recentLogs,
          stats24h: computeStatsFromLogs(logs24h),
        }
      }),
    )
  }

  async function getHealth() {
    const statuses = await repository.listStoreStatuses({
      storeIds: config.stores,
    })
    const logsPerStore = await Promise.all(
      config.stores.map(async (storeId) => ({
        storeId,
        logs: await repository.listSyncLogs({
          storeId,
          limit: 10,
        }),
      })),
    )
    const scheduler = summarizeZeDeliverySchedulerStates(readZeDeliverySchedulerStates())
    const flattenedLogs = logsPerStore.flatMap((entry) =>
      entry.logs.map((log) => ({
        ...log,
        storeId: entry.storeId,
      })),
    )
    const successfulRuns = flattenedLogs.filter((log) => log.summary?.success).length
    const failedRuns = flattenedLogs.filter((log) => log.summary?.success === false).length
    const recentErrors = flattenedLogs.filter((log) => log.summary?.success === false).slice(0, 10)

    return {
      status: scheduler.status,
      enabled: config.enabled,
      storesConfigured: config.stores.length,
      sessionFilePath: config.browser.sessionFilePath,
      lastCheckedAt: new Date().toISOString(),
      lastSync: scheduler.lastSync,
      nextSync: scheduler.nextSync,
      errorCount: scheduler.errorCount,
      successRate:
        successfulRuns + failedRuns > 0 ? successfulRuns / (successfulRuns + failedRuns) : null,
      stores: statuses.map(({ storeId, status }) => ({
        storeId,
        lastSyncAt: status?.lastSyncAt ?? null,
        lastSyncSuccess: status?.lastSyncSuccess ?? null,
        lastSyncError: status?.lastSyncError ?? null,
        counters: status?.counters ?? null,
      })),
      recentErrors,
      scheduler,
    }
  }

  async function getDashboard({ storeIds = config.stores } = {}) {
    const statuses = await getStatus({
      storeIds,
      limit: 20,
    })
    const health = await getHealth()
    const recentRuns = sortByCreatedAtDesc(
      statuses.flatMap((store) =>
        (store.recentLogs ?? []).map((log) => ({
          ...log,
          storeId: store.storeId,
          settings: store.settings,
        })),
      ),
    ).slice(0, 20)
    const merged24hStats = statuses.reduce(
      (summary, store) => {
        summary.deliveriesSynced += Number(store.stats24h?.deliveriesSynced ?? 0)
        summary.errors += Number(store.stats24h?.errors ?? 0)
        summary.totalRuns += Number(store.stats24h?.totalRuns ?? 0)
        summary.averageDurationMsPool.push(Number(store.stats24h?.averageDurationMs ?? 0))
        return summary
      },
      {
        deliveriesSynced: 0,
        errors: 0,
        totalRuns: 0,
        averageDurationMsPool: [],
      },
    )
    const merged24hAverageDurationMs = merged24hStats.averageDurationMsPool.length
      ? Math.round(
          merged24hStats.averageDurationMsPool.reduce((total, value) => total + value, 0) /
            merged24hStats.averageDurationMsPool.length,
        )
      : 0

    return {
      summary: {
        status: health.status,
        lastSync: health.lastSync,
        nextSync: health.nextSync,
        errorCount: health.errorCount,
        successRate: health.successRate,
      },
      scheduler: health.scheduler,
      recentErrors: health.recentErrors,
      recentRuns,
      stats24h: {
        deliveriesSynced: merged24hStats.deliveriesSynced,
        errors: merged24hStats.errors,
        averageDurationMs: merged24hAverageDurationMs,
        failureRate:
          merged24hStats.totalRuns > 0 ? merged24hStats.errors / merged24hStats.totalRuns : 0,
        totalRuns: merged24hStats.totalRuns,
      },
      stores: statuses,
    }
  }

  return {
    ingestScrapedOrders,
    runScrapeAndSync,
    retrySync,
    getStatus,
    getHealth,
    getDashboard,
    getStoreSettings,
    updateStoreSettings,
  }
}
