import { backendEnv } from '../config/env.js';
import { logger } from '../logging/logger.js';
import { captureMessage } from './sentry.js';

const lastAlertAtByKey = new Map();

async function postDiscordAlert(payload) {
  if (!backendEnv.alertDiscordWebhookUrl) {
    return false;
  }

  const response = await fetch(backendEnv.alertDiscordWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Discord alert failed with status ${response.status}`);
  }

  return true;
}

function shouldEmitAlert(key) {
  const now = Date.now();
  const lastAlertAt = lastAlertAtByKey.get(key) ?? 0;

  if ((now - lastAlertAt) < backendEnv.alertCooldownMs) {
    return false;
  }

  lastAlertAtByKey.set(key, now);
  return true;
}

async function emitAlert(key, title, description, context = {}) {
  if (!shouldEmitAlert(key)) {
    return false;
  }

  logger.warn({
    context: 'monitoring.alert',
    alertKey: key,
    title,
    description,
    ...context,
  }, title);

  captureMessage(title, {
    alertKey: key,
    description,
    ...context,
  }, 'warning');

  if (!backendEnv.alertDiscordWebhookUrl) {
    return true;
  }

  await postDiscordAlert({
    username: 'Nexus10 Monitoring',
    embeds: [
      {
        title,
        description,
        color: 15158332,
        timestamp: new Date().toISOString(),
        fields: Object.entries(context).map(([name, value]) => ({
          name,
          value: value == null ? 'n/a' : String(value),
          inline: true,
        })),
      },
    ],
  });

  return true;
}

export async function evaluateMonitoringAlerts(snapshot) {
  const tasks = [];

  if (snapshot.summary.errorRate > backendEnv.alertErrorRateThresholdPercent) {
    tasks.push(emitAlert(
      'error-rate',
      'Nexus10 backend error rate acima do limite',
      `A taxa de erro chegou a ${snapshot.summary.errorRate}% na janela monitorada.`,
      {
        errorRate: `${snapshot.summary.errorRate}%`,
        threshold: `${backendEnv.alertErrorRateThresholdPercent}%`,
        requests: snapshot.summary.totalRequests,
      },
    ));
  }

  if (snapshot.summary.p95 > backendEnv.alertLatencyP95ThresholdMs) {
    tasks.push(emitAlert(
      'latency-p95',
      'Nexus10 backend p95 acima do limite',
      `A latência p95 chegou a ${snapshot.summary.p95}ms na janela monitorada.`,
      {
        p95: `${snapshot.summary.p95}ms`,
        threshold: `${backendEnv.alertLatencyP95ThresholdMs}ms`,
      },
    ));
  }

  if (snapshot.webhooks.failureCount >= backendEnv.alertIfoodWebhookFailureThreshold) {
    tasks.push(emitAlert(
      'ifood-webhook-failures',
      'Falhas de webhook iFood acima do limite',
      `Foram detectadas ${snapshot.webhooks.failureCount} falhas de webhook iFood na janela monitorada.`,
      {
        failures: snapshot.webhooks.failureCount,
        threshold: backendEnv.alertIfoodWebhookFailureThreshold,
        errorRate: `${snapshot.webhooks.errorRate}%`,
      },
    ));
  }

  await Promise.allSettled(tasks);
}
