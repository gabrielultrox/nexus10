# Metricas

## Objetivo

O Nexus10 expoe observabilidade operacional em tres saidas:

- Prometheus em `GET /api/metrics`
- dashboard JSON em `GET /api/admin/monitoring/summary`
- readiness em `GET /api/health/ready`

## Backend

Arquivos principais:

- `backend/monitoring/metrics.js`
- `backend/metrics/prometheus.js`
- `backend/monitoring/alerts.js`

## Metricas HTTP

Incluidas:

- taxa de requests por rota
- distribuicao por status code
- latencia por rota com `p50`, `p95`, `p99`

Metricas Prometheus:

- `nexus_http_requests_total`
- `nexus_http_latency_ms`

## Metricas de negocio

Incluidas:

- pedidos criados na janela atual
- valor total de vendas na janela atual
- taxa de sucesso do webhook iFood

Campos no JSON:

- `business.ordersCreatedLastHour`
- `business.salesTotalAmount`
- `webhooks.successRate`

## Saude do sistema

Incluidas:

- uso de memoria do processo
- uptime do backend
- status do Firestore Admin SDK
- status do Redis
- cache hit/miss/set/invalidation/error
- status do scheduler do Ze Delivery
- contagem de erros do scheduler
- contagem de workers stale do scheduler
- taxa de sucesso do scheduler

Metrica Prometheus:

- `nexus_scheduler_health`

Observacoes:

- O Firestore Admin SDK nao expoe pool de conexao tradicional.
- O endpoint de readiness e seguro para smoke checks e devolve status por dependencia.

## Frontend

Metricas leves mantidas na memoria do navegador:

- page load por rota
- latencia de API
- tempo de render de componentes

Arquivo:

- `src/services/frontendMetrics.ts`

Inspecao local:

```js
window.__NEXUS10_FRONTEND_METRICS__
```

## Endpoints

### Health

```bash
curl http://127.0.0.1:8787/api/health
curl http://127.0.0.1:8787/api/health/ready
```

### Prometheus

```bash
curl http://127.0.0.1:8787/api/metrics
```

### JSON admin

```bash
curl http://127.0.0.1:8787/api/admin/monitoring/summary
```

## Alertas recomendados

- error rate > 5%
- p95 > 1000ms
- falhas de webhook iFood acima do limiar
- scheduler do Ze Delivery degradado, stale ou com erro

## Uso recomendado

1. Configurar scrape Prometheus em `/api/metrics`.
2. Usar `/api/health/ready` em smoke checks de deploy e probes.
3. Usar `/api/admin/monitoring/summary` como painel operacional rapido.
4. Correlacionar incidentes no Sentry por `request_id`, `store_id`, `user_id` e `integration`.
