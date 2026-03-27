import { backendEnv } from '../config/env.js';

const routeMetrics = new Map();
const webhookEvents = [];

function nowMs() {
  return Date.now();
}

function prune(events, windowMs) {
  const minTimestamp = nowMs() - windowMs;

  while (events.length && events[0].timestamp < minTimestamp) {
    events.shift();
  }
}

function getRouteBucket(routeKey) {
  if (!routeMetrics.has(routeKey)) {
    routeMetrics.set(routeKey, []);
  }

  return routeMetrics.get(routeKey);
}

function percentile(values, target) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((target / 100) * sorted.length) - 1));
  return sorted[index];
}

function summarizeEvents(events) {
  const totalRequests = events.length;
  const errorCount = events.filter((event) => event.statusCode >= 500).length;
  const warningCount = events.filter((event) => event.statusCode >= 400).length;
  const durations = events.map((event) => event.durationMs);

  return {
    totalRequests,
    errorCount,
    warningCount,
    errorRate: totalRequests ? Number(((errorCount / totalRequests) * 100).toFixed(2)) : 0,
    p50: Number(percentile(durations, 50).toFixed(2)),
    p95: Number(percentile(durations, 95).toFixed(2)),
    max: Number((Math.max(...durations, 0)).toFixed(2)),
  };
}

function getWindowMs() {
  return backendEnv.monitoringWindowMs;
}

function collectWindowedRouteEvents() {
  const windowMs = getWindowMs();
  const minTimestamp = nowMs() - windowMs;
  const routeEntries = [];

  for (const [routeKey, events] of routeMetrics.entries()) {
    prune(events, windowMs);
    const filteredEvents = events.filter((event) => event.timestamp >= minTimestamp);

    if (!filteredEvents.length) {
      continue;
    }

    routeEntries.push({
      route: routeKey,
      ...summarizeEvents(filteredEvents),
    });
  }

  return routeEntries.sort((left, right) => right.totalRequests - left.totalRequests);
}

export function recordRequestMetric(metric) {
  const routeKey = `${metric.method} ${metric.route}`;
  const bucket = getRouteBucket(routeKey);

  bucket.push({
    timestamp: nowMs(),
    method: metric.method,
    route: metric.route,
    path: metric.path,
    statusCode: metric.statusCode,
    durationMs: metric.durationMs,
  });

  prune(bucket, getWindowMs());

  if (metric.isIfoodWebhook) {
    webhookEvents.push({
      timestamp: nowMs(),
      merchantId: metric.merchantId ?? null,
      storeId: metric.storeId ?? null,
      success: metric.statusCode < 400,
      statusCode: metric.statusCode,
      durationMs: metric.durationMs,
    });
    prune(webhookEvents, getWindowMs());
  }
}

export function getMonitoringSnapshot() {
  const routeEntries = collectWindowedRouteEvents();
  const flattenedEvents = routeEntries.flatMap((entry) => {
    const events = routeMetrics.get(entry.route) ?? [];
    return events;
  });

  const summary = summarizeEvents(flattenedEvents);
  const webhookSummary = summarizeEvents(
    webhookEvents.map((event) => ({
      timestamp: event.timestamp,
      durationMs: event.durationMs,
      statusCode: event.success ? 200 : event.statusCode,
    })),
  );
  const webhookFailures = webhookEvents.filter((event) => !event.success).length;

  return {
    generatedAt: new Date().toISOString(),
    windowMinutes: Math.round(getWindowMs() / 60000),
    thresholds: {
      errorRatePercent: backendEnv.alertErrorRateThresholdPercent,
      latencyP95Ms: backendEnv.alertLatencyP95ThresholdMs,
      ifoodWebhookFailures: backendEnv.alertIfoodWebhookFailureThreshold,
    },
    summary,
    webhooks: {
      totalRequests: webhookEvents.length,
      failureCount: webhookFailures,
      errorRate: webhookSummary.errorRate,
      p95: webhookSummary.p95,
    },
    routes: routeEntries.slice(0, 20),
  };
}

export function resetMonitoringMetrics() {
  routeMetrics.clear();
  webhookEvents.length = 0;
}
