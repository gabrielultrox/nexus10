# Checklist de Monitoramento

## Antes de producao

- Definir `SENTRY_DSN` no backend.
- Definir `VITE_SENTRY_DSN` no frontend.
- Definir `SENTRY_RELEASE` ou garantir fallback por commit SHA.
- Definir `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` e `SENTRY_PROJECT` para upload de sourcemaps.
- Definir `ALERT_DISCORD_WEBHOOK_URL` se alertas externos forem necessarios.
- Confirmar `MONITORING_WINDOW_MS`, `ALERT_ERROR_RATE_THRESHOLD_PERCENT` e `ALERT_LATENCY_P95_THRESHOLD_MS`.

## Validacao de backend

- `GET /api/health` responde `200`.
- `GET /api/health/ready` responde `200` ou `503` com checks detalhados.
- `GET /api/metrics` expoe metricas Prometheus.
- `GET /api/admin/monitoring/summary` retorna JSON consistente.
- `GET /api/admin/monitoring/dashboard` renderiza os cards.
- Os logs do backend incluem `request_id`.
- `npm run ops:smoke` passa no ambiente alvo.

## Validacao de Sentry

- Rodar o smoke test backend: `GET /api/debug/sentry-test` em nao-producao.
- Rodar o smoke test frontend: `window.__NEXUS10_SENTRY_TEST__()`.
- Confirmar que o evento chega com:
  - `request_id`
  - `user_id`
  - `store_id`
- Confirmar a release do evento.
- Confirmar stack trace resolvido com sourcemaps.

## Validacao de alertas

- Simular taxa de erro > 5%.
- Simular p95 > 1s.

## Operacao diaria

- Rodar `npm run ops:smoke` apos deploys relevantes.
- Revisar `/api/admin/monitoring/summary`.
- Revisar issues novas no Sentry por release.
- Revisar taxa de hit/miss do cache.

## Incidentes agora detectaveis

- regressao global de performance do backend
- pico de erros 5xx
- erros frontend/backend correlacionados por release e tags operacionais
