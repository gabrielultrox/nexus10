import { beforeEach, describe, expect, it, vi } from 'vitest';

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
}));

vi.mock('../logging/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  serializeError: (error) => ({ message: error?.message ?? 'unknown' }),
}));

vi.mock('./sentry.js', () => ({
  captureMessage: vi.fn(),
}));

describe('monitoring metrics and alerts', () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  it('calcula error rate e p95 a partir das requests coletadas', async () => {
    const { recordRequestMetric, getMonitoringSnapshot, resetMonitoringMetrics } = await import('./metrics.js');

    resetMonitoringMetrics();

    recordRequestMetric({
      method: 'GET',
      route: '/api/health',
      path: '/api/health',
      statusCode: 200,
      durationMs: 120,
      isIfoodWebhook: false,
    });
    recordRequestMetric({
      method: 'POST',
      route: '/api/stores/:storeId/orders',
      path: '/api/stores/loja-centro/orders',
      statusCode: 500,
      durationMs: 1600,
      isIfoodWebhook: false,
    });

    const snapshot = getMonitoringSnapshot();

    expect(snapshot.summary.totalRequests).toBe(2);
    expect(snapshot.summary.errorRate).toBe(50);
    expect(snapshot.summary.p95).toBe(1600);
  });

  it('dispara alertas quando thresholds sao ultrapassados', async () => {
    const { evaluateMonitoringAlerts } = await import('./alerts.js');
    const { captureMessage } = await import('./sentry.js');

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
    });

    expect(captureMessage).toHaveBeenCalledTimes(3);
  });
});
