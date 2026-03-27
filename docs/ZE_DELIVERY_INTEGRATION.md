# Integracao Zé Delivery

## Objetivo

Automatizar a captura de entregas do painel do Zé Delivery por browser automation e sincronizar os registros com o backend do NEXUS10 sem digitacao manual.

## Arquitetura

- `scripts/ze-delivery-sync.js`
  - worker agendado por `node-cron`
  - faz login, scrape e envia para o backend
- `backend/integrations/ze-delivery/zeDeliveryAdapter.js`
  - automacao Playwright
  - reuso de sessao com `storageState`
- `backend/integrations/ze-delivery/zeDeliveryService.js`
  - deduplicacao
  - persistencia
  - historico e status
- `backend/repositories/zeDeliveryOrderRepository.js`
  - acesso Firestore
- `backend/routes/ze-delivery.js`
  - ingestao
  - status
  - sync manual
  - retry

## Variaveis de ambiente

Obrigatorias quando `ZE_DELIVERY_ENABLED=true`:

- `ZE_DELIVERY_EMAIL`
- `ZE_DELIVERY_PASSWORD`
- `ZE_DELIVERY_LOGIN_URL`
- `ZE_DELIVERY_DASHBOARD_URL_TEMPLATE`
- `ZE_DELIVERY_SYNC_TOKEN`

Principais adicionais:

- `ZE_DELIVERY_STORE_IDS`
- `ZE_DELIVERY_SYNC_INTERVAL_MINUTES`
- `ZE_DELIVERY_HEADLESS`
- `ZE_DELIVERY_DRY_RUN`
- `ZE_DELIVERY_NEXUS_API_BASE_URL`
- `ZE_DELIVERY_SESSION_FILE`
- seletores `ZE_DELIVERY_*_SELECTOR`

## Como rodar

Rodar um ciclo unico:

```bash
npm run ze-delivery:sync -- --once --storeId=loja-01
```

Rodar scheduler:

```bash
npm run ze-delivery:watch
```

Rodar teste interativo do scraper:

```bash
npm run ze-delivery:test -- --storeId=loja-01
```

## Endpoints

### Ingestao interna

`POST /api/integrations/ze-delivery/orders`

- autenticacao por `X-Ze-Delivery-Token`
- recebe lote de entregas raspadas

### Status

`GET /api/integrations/ze-delivery/status?storeId=loja-01&limit=20`

- exige usuario autenticado com permissao `integrations:write`

### Sync manual

`POST /api/integrations/ze-delivery/sync`

Body:

```json
{
  "storeId": "loja-01",
  "dryRun": false,
  "maxOrders": 50
}
```

### Retry manual

`POST /api/integrations/ze-delivery/orders/:storeId/:zeDeliveryId/retry`

### Health

`GET /api/integrations/ze-delivery/health`

## Firestore

Estrutura utilizada:

```text
/stores/{storeId}/integrations/ze_delivery
/stores/{storeId}/integrations/ze_delivery/orders/{zeDeliveryId}
/stores/{storeId}/integrations/ze_delivery/sync_logs/{logId}
```

## Seletores do site

Como o Zé Delivery nao tem API publica, o scraper depende de seletores configuraveis por `.env`.

Padrao recomendado:

- primeiro validar o login com `npm run ze-delivery:test -- --storeId=<id>`
- depois ajustar:
  - `ZE_DELIVERY_ORDER_ROW_SELECTOR`
  - `ZE_DELIVERY_CODE_SELECTOR`
  - `ZE_DELIVERY_STATUS_SELECTOR`
  - `ZE_DELIVERY_LOCATION_SELECTOR`
  - `ZE_DELIVERY_SCANNED_BY_SELECTOR`

### Suporte a atributos

Seletores aceitam a sintaxe:

```text
[data-testid="delivery-row"] [data-lat]@@data-lat
```

Nesse caso o scraper le o atributo `data-lat`, nao o texto.

## Seguranca

- credenciais ficam apenas em `.env`
- senha e token nao sao escritos em logs
- endpoint de ingestao exige token dedicado
- status manual exige autenticacao do backend e permissao de integracao

## Troubleshooting

### Login funciona localmente, mas expira no servidor

- monte um volume persistente para `ZE_DELIVERY_SESSION_FILE`
- valide se o 2FA exige aprovacao humana frequente

### O site mudou

- rode `npm run ze-delivery:test -- --storeId=<id>`
- ajuste os seletores no `.env`

### O container nao abre Chromium

- use uma imagem com deps do Playwright ou instale browsers com:

```bash
npx playwright install --with-deps chromium
```

### O scraper sincroniza, mas o painel nao mostra nada

- confira `GET /api/integrations/ze-delivery/status`
- confira `sync_logs`
- valide o `storeId` usado pelo worker
