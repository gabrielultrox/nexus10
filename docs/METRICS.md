# Metrics

## Objetivo

O Nexus10 expõe observability básica em dois formatos:

- Prometheus-style em `GET /api/metrics`
- dashboard JSON em `GET /api/admin/monitoring/summary`

## Backend

Arquivos principais:

- `backend/monitoring/metrics.js`
- `backend/metrics/prometheus.js`

## Métricas HTTP

Incluídas:

- taxa de requests por rota
- distribuição por status code
- latência por rota com `p50`, `p95`, `p99`

Endpoint Prometheus:

- `GET /api/metrics`

Exemplos:

- `nexus_http_requests_total`
- `nexus_http_latency_ms`

## Métricas de negócio

Incluídas:

- pedidos criados na janela atual
- valor total de vendas na janela atual
- taxa de sucesso de webhook iFood

No JSON:

- `business.ordersCreatedLastHour`
- `business.salesTotalAmount`
- `webhooks.successRate`

## Saúde do sistema

Incluídas:

- uso de memória do processo
- uptime do backend
- status do Firestore Admin SDK
- status do Redis
- cache hit/miss/set/invalidation/error

Observação:

O Firestore Admin SDK não expõe pool de conexão tradicional. Por isso o Nexus10 publica:

- `configured`
- `initialized`
- `pool: "not_applicable"`

## Frontend

Métricas leves em memória do navegador:

- page load por rota
- latência de chamadas de API
- tempo de render de componentes principais

Arquivo:

- `src/services/frontendMetrics.ts`

Inspeção local no navegador:

```js
window.__NEXUS10_FRONTEND_METRICS__
```

## Endpoints

### Prometheus

```bash
curl http://127.0.0.1:8787/api/metrics
```

### JSON admin

```bash
curl http://127.0.0.1:8787/api/admin/monitoring/summary
```

## Uso recomendado

1. Prometheus scrape em `/api/metrics`
2. dashboard operacional usando `/api/admin/monitoring/summary`
3. alertas a partir de:
   - erro > 5%
   - p95 > 1000ms
   - webhook failure rate acima do limiar
