# Sentry

## Objetivo

O Nexus10 usa Sentry para:

- capturar erros backend e frontend
- monitorar performance com traces
- anexar contexto operacional (`user_id`, `store_id`, `request_id`)
- opcionalmente gravar session replay no frontend

## Variaveis de ambiente

### Backend

- `SENTRY_DSN`
- `SENTRY_RELEASE`
- `SENTRY_TRACES_SAMPLE_RATE`

Fallback de release no backend:

- `VERCEL_GIT_COMMIT_SHA`
- `GITHUB_SHA`
- `RENDER_GIT_COMMIT`
- `npm_package_version`

### Frontend

- `VITE_SENTRY_DSN`
- `VITE_SENTRY_RELEASE`
- `VITE_SENTRY_TRACES_SAMPLE_RATE`
- `VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE`
- `VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE`

Fallback de release no frontend:

- `VITE_SENTRY_RELEASE`
- `SENTRY_RELEASE`
- `VERCEL_GIT_COMMIT_SHA`
- `GITHUB_SHA`
- `npm_package_version`

### Upload de sourcemaps

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_RELEASE`

## Backend

Arquivo principal:

- `backend/config/sentry.js`

Integracao:

- inicializacao no boot do Express
- middleware para escopo automatico por request
- captura de erros nao tratados do Express
- captura de `unhandledRejection` e `uncaughtException`

Tags automaticas:

- `request_id`
- `user_id`
- `store_id`
- `merchant_id`
- `integration`

## Frontend

Arquivo principal:

- `src/config/sentry.ts`

Integracao:

- boot do app chama `initializeFrontendSentry()`
- `ErrorBoundary` envia excecoes render-time
- `App.jsx` sincroniza `user_id` e `store_id`
- traces de navegacao via `browserTracingIntegration`
- replay opcional via sample rate

## Sourcemaps

O build do Vite faz upload automatico quando as variaveis abaixo existem:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_RELEASE`

Script:

```bash
npm run sentry:upload-sourcemaps
```

Observacao:

- o `vite.config.js` agora injeta release fallback automaticamente no bundle
- o plugin de sourcemaps usa o mesmo release resolvido, reduzindo divergencia entre evento e artifact

## Smoke test

### Frontend

Com o app aberto no navegador:

```js
window.__NEXUS10_SENTRY_TEST__()
```

### Backend

Em ambiente nao-producao:

```bash
curl http://127.0.0.1:8787/api/debug/sentry-test
```

Esse endpoint gera um erro proposital e envia o evento para o Sentry antes de responder `500`.

## Fluxo recomendado

1. definir DSN backend e frontend
2. definir `SENTRY_RELEASE`
3. buildar frontend com upload de sourcemaps
4. rodar `npm run ops:smoke`
5. abrir o app e rodar o smoke test
6. confirmar evento e trace no dashboard
7. confirmar que o evento aponta para a release esperada
8. abrir o stack trace e validar sourcemap resolvido

## Boas praticas

- manter sample rate de replay baixo em producao
- usar release fixo por deploy
- nao enviar PII desnecessaria
- revisar issues agrupadas por release
