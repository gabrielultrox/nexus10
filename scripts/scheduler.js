import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

import cron from 'node-cron'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

import { getZeDeliveryConfig, getZeDeliveryCronExpression } from '../backend/config/ze-delivery.js'
import { createZeDeliveryAdapter } from '../backend/integrations/ze-delivery/zeDeliveryAdapter.js'
import { createZeDeliveryOrderRepository } from '../backend/repositories/zeDeliveryOrderRepository.js'

const LOG_DIRECTORY = path.resolve(process.cwd(), 'logs')
const STATE_DIRECTORY = path.resolve(process.cwd(), 'tmp')

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true })
}

function parseArgs(argv) {
  const args = new Set(argv.slice(2))
  const storeIdFlag = argv.find((entry) => entry.startsWith('--storeId='))

  return {
    once: args.has('--once'),
    headed: args.has('--headed'),
    dryRun: args.has('--dry-run'),
    noImmediate: args.has('--no-immediate'),
    storeId: storeIdFlag ? storeIdFlag.split('=')[1] : '',
  }
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code ?? null,
      status: error.status ?? null,
    }
  }

  return {
    name: 'UnknownError',
    message: String(error),
  }
}

function createSchedulerLogger({ instanceLabel, logLevel }) {
  ensureDirectory(LOG_DIRECTORY)

  return winston.createLogger({
    level: logLevel,
    defaultMeta: {
      service: 'nexus10-ze-delivery-sync',
      instance: instanceLabel,
    },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      }),
      new DailyRotateFile({
        dirname: LOG_DIRECTORY,
        filename: 'ze-delivery-sync-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d',
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      }),
    ],
  })
}

function resolveWorkerContext(config, cliStoreId = '') {
  const workerIndex = Number.parseInt(
    process.env.NODE_APP_INSTANCE ?? process.env.PM2_INSTANCE_ID ?? '0',
    10,
  )
  const workerCount = Math.max(1, Number.parseInt(process.env.ZE_DELIVERY_WORKER_COUNT ?? '2', 10))
  const instanceLabel = `worker-${Number.isFinite(workerIndex) ? workerIndex : 0}`

  return {
    workerIndex: Number.isFinite(workerIndex) ? workerIndex : 0,
    workerCount,
    instanceLabel,
    selectedStores: cliStoreId
      ? [cliStoreId]
      : config.stores.filter((_storeId, index) => index % workerCount === workerIndex),
  }
}

function buildStateFilePath(instanceLabel) {
  ensureDirectory(STATE_DIRECTORY)
  return path.join(STATE_DIRECTORY, `ze-delivery-scheduler-state-${instanceLabel}.json`)
}

function writeState(filePath, state) {
  ensureDirectory(path.dirname(filePath))
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8')
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

async function pushToNexus({ config, storeId, deliveries, dryRun, logger }) {
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
              runId: `scheduler-${Date.now()}-${storeId}`,
              trigger: 'scheduler',
              source: 'pm2-cron',
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
        logger.warn('Retrying Ze Delivery sync request', {
          context: 'ze_delivery.scheduler.retry',
          storeId,
          attempt,
          error: serializeError(error),
        })
      },
    },
  )
}

export function createZeDeliveryScheduler({
  config = getZeDeliveryConfig(),
  args = parseArgs(process.argv),
} = {}) {
  const workerContext = resolveWorkerContext(config, args.storeId)
  const logger = createSchedulerLogger({
    instanceLabel: workerContext.instanceLabel,
    logLevel: process.env.ZE_DELIVERY_SCHEDULER_LOG_LEVEL || 'info',
  })
  const adapter = createZeDeliveryAdapter({
    config: {
      ...config,
      browser: {
        ...config.browser,
        headless: args.headed ? false : config.browser.headless,
      },
    },
  })
  const repository = createZeDeliveryOrderRepository()
  const cronExpression = getZeDeliveryCronExpression(config)
  const stateFilePath = buildStateFilePath(workerContext.instanceLabel)

  let state = {
    service: 'nexus10-ze-delivery-sync',
    instance: workerContext.instanceLabel,
    workerIndex: workerContext.workerIndex,
    workerCount: workerContext.workerCount,
    stores: workerContext.selectedStores,
    cronExpression,
    status: 'idle',
    errorCount: 0,
    successCount: 0,
    failureCount: 0,
    lastSyncAt: null,
    lastSuccessAt: null,
    nextSyncAt: null,
    lastError: null,
    lastResults: [],
    updatedAt: new Date().toISOString(),
  }
  let schedulerTask = null
  let currentRun = null
  let stopping = false

  const computeNextSyncAt = () =>
    new Date(Date.now() + config.sync.intervalMinutes * 60 * 1000).toISOString()

  const persistState = (patch = {}) => {
    state = {
      ...state,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    writeState(stateFilePath, state)
  }

  const loadStoreSettings = async (storeId) => {
    const settings = await repository.getStoreSettings({ storeId })

    return {
      enabled: settings?.enabled ?? config.enabled,
      intervalMinutes: Number(settings?.intervalMinutes ?? config.sync.intervalMinutes),
      notificationsEnabled: Boolean(settings?.notificationsEnabled ?? false),
      notificationWebhookUrl: settings?.notificationWebhookUrl ?? '',
    }
  }

  const runCycle = async ({ trigger = 'scheduler' } = {}) => {
    if (currentRun) {
      logger.warn('Skipping scheduler cycle because another run is active', {
        context: 'ze_delivery.scheduler.skip_busy',
        trigger,
      })
      return currentRun
    }

    currentRun = (async () => {
      const startedAt = Date.now()
      persistState({
        status: 'running',
        lastError: null,
      })

      try {
        if (!config.enabled) {
          throw new Error('ZE_DELIVERY_ENABLED=false. Scheduler desabilitado.')
        }

        if (!workerContext.selectedStores.length) {
          logger.info('No stores assigned to this scheduler worker', {
            context: 'ze_delivery.scheduler.no_stores',
            workerIndex: workerContext.workerIndex,
            workerCount: workerContext.workerCount,
          })
          persistState({
            status: 'idle',
            nextSyncAt: computeNextSyncAt(),
          })
          return []
        }

        const results = []
        for (const storeId of workerContext.selectedStores) {
          const storeRunStartedAt = Date.now()

          try {
            const storeSettings = await loadStoreSettings(storeId)
            const storeStatus = await repository.getStoreStatus({ storeId })
            const lastSyncAt = storeStatus?.lastSyncAt
              ? new Date(storeStatus.lastSyncAt).getTime()
              : 0
            const intervalMs = Math.max(5, Number(storeSettings.intervalMinutes) || 10) * 60 * 1000
            const shouldSkipByInterval =
              trigger === 'cron' && lastSyncAt > 0 && Date.now() - lastSyncAt < intervalMs

            if (!storeSettings.enabled) {
              results.push({
                storeId,
                skipped: true,
                reason: 'disabled',
              })
              continue
            }

            if (shouldSkipByInterval) {
              results.push({
                storeId,
                skipped: true,
                reason: 'interval_not_reached',
              })
              continue
            }

            const scrapeResult = await adapter.scrapeDeliveries({
              storeId,
              maxOrders: config.sync.maxOrdersPerRun,
            })
            const syncPayload = await pushToNexus({
              config,
              storeId,
              deliveries: scrapeResult.deliveries,
              dryRun: args.dryRun || config.sync.dryRun,
              logger,
            })

            results.push({
              storeId,
              scraped: scrapeResult.deliveries.length,
              syncPayload,
              settings: storeSettings,
            })
          } catch (error) {
            const serializedError = serializeError(error)
            const failureCreatedAt = new Date().toISOString()

            await repository.appendSyncLog({
              storeId,
              log: {
                source: 'ze_delivery',
                trigger,
                createdAt: failureCreatedAt,
                summary: {
                  runId: `scheduler-error-${Date.now()}-${storeId}`,
                  processed: 0,
                  created: 0,
                  updated: 0,
                  unchanged: 0,
                  failed: 1,
                  success: false,
                  dryRun: args.dryRun || config.sync.dryRun,
                  durationMs: Date.now() - storeRunStartedAt,
                  startedAt: new Date(storeRunStartedAt).toISOString(),
                  completedAt: failureCreatedAt,
                  trigger,
                  error: serializedError,
                },
              },
            })

            await repository.setStoreStatus({
              storeId,
              status: {
                enabled: true,
                lastSyncAt: failureCreatedAt,
                lastSyncSuccess: false,
                lastSyncError: serializedError.message,
                counters: {
                  created: 0,
                  updated: 0,
                  unchanged: 0,
                  failed: 1,
                },
              },
            })

            results.push({
              storeId,
              error: serializedError,
            })
          }
        }

        const hasStoreErrors = results.some((result) => Boolean(result.error))

        persistState({
          status: hasStoreErrors ? 'degraded' : 'idle',
          successCount: Number(state.successCount ?? 0) + (hasStoreErrors ? 0 : 1),
          failureCount: Number(state.failureCount ?? 0) + (hasStoreErrors ? 1 : 0),
          errorCount: Number(state.errorCount ?? 0) + (hasStoreErrors ? 1 : 0),
          lastSyncAt: new Date().toISOString(),
          lastSuccessAt: hasStoreErrors ? state.lastSuccessAt : new Date().toISOString(),
          nextSyncAt: computeNextSyncAt(),
          lastDurationMs: Date.now() - startedAt,
          lastResults: results,
          lastError: hasStoreErrors
            ? (results.find((result) => result.error)?.error ?? null)
            : null,
        })

        logger.info('Ze Delivery scheduler cycle completed', {
          context: 'ze_delivery.scheduler.cycle_complete',
          trigger,
          durationMs: Date.now() - startedAt,
          stores: workerContext.selectedStores,
          results,
        })

        return results
      } catch (error) {
        persistState({
          status: 'degraded',
          errorCount: Number(state.errorCount ?? 0) + 1,
          failureCount: Number(state.failureCount ?? 0) + 1,
          lastSyncAt: new Date().toISOString(),
          nextSyncAt: computeNextSyncAt(),
          lastDurationMs: Date.now() - startedAt,
          lastError: serializeError(error),
        })

        logger.error('Ze Delivery scheduler cycle failed', {
          context: 'ze_delivery.scheduler.cycle_failed',
          trigger,
          durationMs: Date.now() - startedAt,
          error: serializeError(error),
        })
        throw error
      } finally {
        currentRun = null
      }
    })()

    return currentRun
  }

  const shutdown = async (signal = 'SIGTERM') => {
    if (stopping) {
      return
    }

    stopping = true
    schedulerTask?.stop()
    logger.info('Stopping Ze Delivery scheduler', {
      context: 'ze_delivery.scheduler.shutdown',
      signal,
    })

    try {
      await currentRun
    } catch {
      // already logged
    }

    await adapter.close().catch(() => {})
    persistState({
      status: 'stopped',
      nextSyncAt: null,
    })
  }

  const start = async () => {
    persistState({
      status: 'idle',
      startedAt: new Date().toISOString(),
      nextSyncAt: computeNextSyncAt(),
    })

    if (!args.noImmediate && !args.once) {
      await runCycle({
        trigger: 'startup',
      }).catch(() => {})
    }

    if (args.once) {
      return runCycle({
        trigger: 'manual-once',
      })
    }

    schedulerTask = cron.schedule(
      cronExpression,
      async () => {
        await runCycle({
          trigger: 'cron',
        }).catch(() => {})
      },
      {
        scheduled: true,
      },
    )

    logger.info('Ze Delivery scheduler started', {
      context: 'ze_delivery.scheduler.started',
      cronExpression,
      stateFilePath,
      stores: workerContext.selectedStores,
      workerIndex: workerContext.workerIndex,
      workerCount: workerContext.workerCount,
    })

    process.on('SIGINT', () => {
      shutdown('SIGINT')
        .catch(() => {})
        .finally(() => process.exit(0))
    })
    process.on('SIGTERM', () => {
      shutdown('SIGTERM')
        .catch(() => {})
        .finally(() => process.exit(0))
    })

    return schedulerTask
  }

  return {
    start,
    shutdown,
    runCycle,
    getState: () => state,
  }
}

export async function runSchedulerCli() {
  const args = parseArgs(process.argv)
  const scheduler = createZeDeliveryScheduler({ args })

  try {
    const result = await scheduler.start()

    if (args.once) {
      await scheduler.shutdown('once-complete')
    }

    return result
  } catch (error) {
    await scheduler.shutdown('fatal').catch(() => {})
    throw error
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSchedulerCli().catch((error) => {
    process.stderr.write(
      `${JSON.stringify({
        message: 'Ze Delivery scheduler failed',
        error: serializeError(error),
      })}\n`,
    )
    process.exitCode = 1
  })
}
