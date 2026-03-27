type FrontendMetricSample = {
  name: string
  value: number
  unit: 'ms' | 'count'
  timestamp: string
  tags?: Record<string, string | number | boolean | null>
}

const MAX_SAMPLES = 200

function getMetricStore(): FrontendMetricSample[] {
  if (typeof window === 'undefined') {
    return []
  }

  window.__NEXUS10_FRONTEND_METRICS__ ??= []
  return window.__NEXUS10_FRONTEND_METRICS__
}

function pushMetric(sample: FrontendMetricSample) {
  const store = getMetricStore()
  store.push(sample)

  if (store.length > MAX_SAMPLES) {
    store.splice(0, store.length - MAX_SAMPLES)
  }
}

export function recordFrontendMetric(
  name: string,
  value: number,
  unit: 'ms' | 'count',
  tags?: Record<string, string | number | boolean | null>,
) {
  pushMetric({
    name,
    value: Number(value.toFixed(2)),
    unit,
    timestamp: new Date().toISOString(),
    tags,
  })
}

export function recordPageLoadMetric(route: string, startedAt: number) {
  recordFrontendMetric('page_load', performance.now() - startedAt, 'ms', {
    route,
  })
}

export function recordApiLatencyMetric(path: string, method: string, durationMs: number) {
  recordFrontendMetric('api_latency', durationMs, 'ms', {
    path,
    method,
  })
}

export function recordComponentRenderMetric(component: string, durationMs: number) {
  recordFrontendMetric('component_render', durationMs, 'ms', {
    component,
  })
}

export function getFrontendMetricsSnapshot() {
  return [...getMetricStore()]
}

declare global {
  interface Window {
    __NEXUS10_FRONTEND_METRICS__?: FrontendMetricSample[]
  }
}
