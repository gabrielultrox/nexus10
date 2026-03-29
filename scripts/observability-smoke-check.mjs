const baseUrl = (process.env.NEXUS_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '')
const includeSentryTest = process.argv.includes('--include-sentry-test')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function fetchJson(path, expectedStatuses = [200]) {
  const response = await fetch(`${baseUrl}${path}`)
  const payload = await response.json().catch(() => ({}))

  assert(
    expectedStatuses.includes(response.status),
    `${path} respondeu ${response.status}. Body: ${JSON.stringify(payload)}`,
  )

  return { response, payload }
}

async function fetchText(path, expectedStatuses = [200]) {
  const response = await fetch(`${baseUrl}${path}`)
  const payload = await response.text()

  assert(
    expectedStatuses.includes(response.status),
    `${path} respondeu ${response.status}. Body: ${payload}`,
  )

  return { response, payload }
}

async function main() {
  console.log(`[ops] Validando backend em ${baseUrl}`)

  const health = await fetchJson('/api/health')
  assert(health.payload.status === 'ok', '/api/health nao retornou status ok')

  const readiness = await fetchJson('/api/health/ready', [200, 503])
  assert(
    readiness.payload.checks?.metrics?.status === 'ok',
    '/api/health/ready nao reportou metrics ok',
  )
  assert(readiness.payload.checks?.firestore, '/api/health/ready nao trouxe check de firestore')
  assert(readiness.payload.checks?.scheduler, '/api/health/ready nao trouxe check de scheduler')

  const metrics = await fetchText('/api/metrics')
  for (const metricName of [
    'nexus_http_requests_total',
    'nexus_http_latency_ms',
    'nexus_ifood_webhook_success_rate',
    'nexus_scheduler_health',
  ]) {
    assert(metrics.payload.includes(metricName), `/api/metrics nao contem ${metricName}`)
  }

  if (includeSentryTest) {
    const sentry = await fetchJson('/api/debug/sentry-test', [500, 404])
    assert(
      sentry.response.status === 500 || sentry.response.status === 404,
      'Smoke test do Sentry retornou status inesperado',
    )
  }

  console.log('[ops] /api/health ok')
  console.log(`[ops] /api/health/ready status ${readiness.response.status}`)
  if (readiness.response.status !== 200) {
    console.log(`[ops] /api/health/ready body ${JSON.stringify(readiness.payload)}`)
  }
  console.log('[ops] /api/metrics ok')
  console.log('[ops] Smoke check concluido')
}

main().catch((error) => {
  console.error(`[ops] Falha no smoke check: ${error.message}`)
  process.exitCode = 1
})
