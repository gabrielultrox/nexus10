import { getObservabilitySnapshot } from '../monitoring/metrics.js'

function sanitizeLabel(value) {
  return String(value ?? 'unknown')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
}

function pushMetric(lines, name, help, type, samples) {
  lines.push(`# HELP ${name} ${help}`)
  lines.push(`# TYPE ${name} ${type}`)

  samples.forEach(({ labels = {}, value }) => {
    const labelEntries = Object.entries(labels)
      .filter(([, labelValue]) => labelValue != null && labelValue !== '')
      .map(([key, labelValue]) => `${key}="${sanitizeLabel(labelValue)}"`)

    const labelString = labelEntries.length ? `{${labelEntries.join(',')}}` : ''
    lines.push(`${name}${labelString} ${value}`)
  })
}

export async function buildPrometheusMetrics() {
  const snapshot = await getObservabilitySnapshot()
  const lines = []

  pushMetric(
    lines,
    'nexus_http_requests_total',
    'Total HTTP requests by route and status code.',
    'counter',
    [
      ...snapshot.routes.flatMap((route) =>
        Object.entries(route.statusCodes).map(([statusCode, count]) => ({
          labels: { route: route.route, status_code: statusCode },
          value: count,
        })),
      ),
    ],
  )

  pushMetric(
    lines,
    'nexus_http_latency_ms',
    'HTTP latency percentiles by route in milliseconds.',
    'gauge',
    snapshot.routes.flatMap((route) => [
      { labels: { route: route.route, quantile: '0.50' }, value: route.p50 },
      { labels: { route: route.route, quantile: '0.95' }, value: route.p95 },
      { labels: { route: route.route, quantile: '0.99' }, value: route.p99 },
    ]),
  )

  pushMetric(
    lines,
    'nexus_business_orders_created_last_hour',
    'Orders created in the current observability window.',
    'gauge',
    [{ value: snapshot.business.ordersCreatedLastHour }],
  )

  pushMetric(
    lines,
    'nexus_business_sales_total_amount',
    'Total sales amount in the current window.',
    'gauge',
    [{ value: snapshot.business.salesTotalAmount }],
  )

  pushMetric(lines, 'nexus_cache_hits_total', 'Cache hits recorded by the backend.', 'counter', [
    { value: snapshot.system.cache.hits },
  ])
  pushMetric(
    lines,
    'nexus_cache_misses_total',
    'Cache misses recorded by the backend.',
    'counter',
    [{ value: snapshot.system.cache.misses }],
  )

  pushMetric(
    lines,
    'nexus_process_memory_mb',
    'Backend process memory usage in megabytes.',
    'gauge',
    [
      { labels: { area: 'rss' }, value: snapshot.system.memory.rssMb },
      { labels: { area: 'heap_total' }, value: snapshot.system.memory.heapTotalMb },
      { labels: { area: 'heap_used' }, value: snapshot.system.memory.heapUsedMb },
      { labels: { area: 'external' }, value: snapshot.system.memory.externalMb },
    ],
  )

  pushMetric(lines, 'nexus_service_uptime_seconds', 'Backend process uptime in seconds.', 'gauge', [
    { value: snapshot.system.processUptimeSeconds },
  ])

  pushMetric(
    lines,
    'nexus_firestore_status',
    'Firestore admin SDK initialization status.',
    'gauge',
    [
      { labels: { state: 'configured' }, value: snapshot.system.database.configured ? 1 : 0 },
      { labels: { state: 'initialized' }, value: snapshot.system.database.initialized ? 1 : 0 },
    ],
  )

  pushMetric(lines, 'nexus_redis_status', 'Redis connectivity status.', 'gauge', [
    { labels: { state: 'configured' }, value: snapshot.system.cache.configured ? 1 : 0 },
    { labels: { state: 'connected' }, value: snapshot.system.cache.status === 'connected' ? 1 : 0 },
  ])

  return `${lines.join('\n')}\n`
}
