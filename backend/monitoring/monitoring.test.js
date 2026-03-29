import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../config/env.js', () => ({
  backendEnv: {
    monitoringWindowMs: 15 * 60 * 1000,
    alertCooldownMs: 10 * 60 * 1000,
    alertDiscordWebhookUrl: '',
    alertErrorRateThresholdPercent: 5,
    alertLatencyP95ThresholdMs: 1000,
    alertIfoodWebhookFailureThreshold: 3,
    sentryDsn: '',
    sentryRelease: '',
    sentryTracesSampleRate: 0.2,
    nodeEnv: 'test',
  },
  hasFirebaseAdminConfig: () => true,
}))

vi.mock('../logging/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLoggerContext: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  serializeError: (error) => ({ message: error?.message ?? 'unknown' }),
}))

vi.mock('./sentry.js', () => ({
  captureMessage: vi.fn(),
}))

vi.mock('../middleware/health-check.js', () => ({
  readZeDeliverySchedulerStates: vi.fn(() => []),
  summarizeZeDeliverySchedulerStates: vi.fn(() => ({
    status: 'idle',
    lastSync: null,
    nextSync: null,
    errorCount: 0,
    successRate: null,
    staleWorkerCount: 0,
    staleWorkers: [],
    workers: [],
  })),
}))

describe('monitoring metrics and alerts', () => {
  beforeEach(async () => {
    vi.resetModules()
  })

  it('calcula error rate e p95 a partir das requests coletadas', async () => {
    const { recordRequestMetric, getMonitoringSnapshot, resetMonitoringMetrics } = await import(
      './metrics.js'
    )

    resetMonitoringMetrics()

    recordRequestMetric({
      method: 'GET',
      route: '/api/stores/:storeId/sales',
      path: '/api/stores/loja-centro/sales',
      statusCode: 200,
      durationMs: 120,
      isIfoodWebhook: false,
    })
    recordRequestMetric({
      method: 'POST',
      route: '/api/stores/:storeId/orders',
      path: '/api/stores/loja-centro/orders',
      statusCode: 500,
      durationMs: 1600,
      isIfoodWebhook: false,
    })

    const snapshot = getMonitoringSnapshot()

    expect(snapshot.summary.totalRequests).toBe(2)
    expect(snapshot.summary.errorRate).toBe(50)
    expect(snapshot.summary.p95).toBe(1600)
  })

  it('dispara alertas quando thresholds sao ultrapassados', async () => {
    const { evaluateMonitoringAlerts } = await import('./alerts.js')
    const { captureMessage } = await import('./sentry.js')

    await evaluateMonitoringAlerts({
      summary: {
        totalRequests: 100,
        errorRate: 7,
        p95: 1500,
      },
      webhooks: {
        failureCount: 4,
        errorRate: 12,
      },
    })

    expect(captureMessage).toHaveBeenCalledTimes(3)
  })

  it('inclui o estado do scheduler no snapshot operacional', async () => {
    const { summarizeZeDeliverySchedulerStates } = await import('../middleware/health-check.js')
    const { getMonitoringSnapshot, resetMonitoringMetrics } = await import('./metrics.js')

    summarizeZeDeliverySchedulerStates.mockReturnValue({
      status: 'degraded',
      lastSync: '2026-03-27T20:00:00.000Z',
      nextSync: '2026-03-27T20:05:00.000Z',
      errorCount: 2,
      successRate: 0.75,
      staleWorkerCount: 1,
      staleWorkers: [{ id: 'worker-2' }],
      workers: [{ id: 'worker-1' }, { id: 'worker-2' }],
    })

    resetMonitoringMetrics()
    const snapshot = getMonitoringSnapshot()

    expect(snapshot.system.scheduler.status).toBe('degraded')
    expect(snapshot.system.scheduler.errorCount).toBe(2)
    expect(snapshot.system.scheduler.staleWorkerCount).toBe(1)
    expect(snapshot.system.scheduler.successRate).toBe(75)
    expect(snapshot.system.scheduler.workerCount).toBe(2)
  })

  it('dispara alerta quando o scheduler entra em estado degradado', async () => {
    const { evaluateMonitoringAlerts } = await import('./alerts.js')
    const { captureMessage } = await import('./sentry.js')

    await evaluateMonitoringAlerts({
      summary: {
        totalRequests: 10,
        errorRate: 0,
        p95: 100,
      },
      webhooks: {
        failureCount: 0,
        errorRate: 0,
      },
      system: {
        scheduler: {
          status: 'degraded',
          errorCount: 3,
          staleWorkerCount: 1,
          successRate: 42,
          lastSyncAt: '2026-03-27T20:00:00.000Z',
          nextSyncAt: '2026-03-27T20:05:00.000Z',
        },
      },
    })

    expect(captureMessage).toHaveBeenCalledTimes(1)
  })
})
