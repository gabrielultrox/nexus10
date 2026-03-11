# Base de Integracao iFood

## Objetivo

Preparar a integracao iFood para:

- polling oficial de eventos
- webhook oficial de eventos
- busca de detalhes do pedido
- persistencia normalizada multi-loja
- tracking desacoplado do widget
- extensao futura para outros canais por adapters separados

## Arquitetura

### Camada backend/services

- `backend/integrations/ifood/ifoodAdapter.js`
  - encapsula chamadas oficiais do iFood
  - `POST /authentication/v1.0/oauth/token`
  - `GET /events/v1.0/events:polling`
  - `POST /events/v1.0/events/acknowledgment`
  - `GET /order/v1.0/orders/{id}`

- `backend/integrations/ifood/ifoodEventService.js`
  - processa polling
  - processa webhook
  - valida assinatura `X-IFood-Signature`
  - evita duplicidade por `event.id`
  - registra logs de sincronizacao

- `backend/integrations/ifood/ifoodOrderService.js`
  - normaliza detalhes do pedido externo
  - monta timeline
  - gera tracking persistido

- `backend/integrations/ifood/ifoodStatusMapper.js`
  - converte status/eventos do iFood para status interno

- `backend/integrations/ifood/ifoodFirestoreRepository.js`
  - implementa a persistencia da integracao no Firestore

### Persistencia Firestore por loja

Todos os dados ficam em `stores/{storeId}/...`

- `external_orders`
- `external_order_events`
- `external_order_tracking`
- `integration_logs`
- `integration_merchants`

## Modelo interno normalizado

Cada pedido externo salvo em `external_orders` segue a estrutura:

- `externalOrderId`
- `source`
- `merchantId`
- `customer`
- `items`
- `subtotal`
- `discount`
- `shipping`
- `total`
- `paymentMethod`
- `externalStatus`
- `normalizedStatus`
- `tracking`
- `createdAt`
- `updatedAt`

## Entrada de dados

### Polling

1. backend busca token OAuth do merchant
2. backend chama `events:polling`
3. para cada evento inedito:
   - grava evento
   - busca detalhes do pedido
   - normaliza pedido
   - grava tracking quando aplicavel
4. envia ACK dos eventos processados
5. grava log de sincronizacao

### Webhook

1. iFood envia evento para `IFOOD_WEBHOOK_URL`
2. backend valida `X-IFood-Signature`
3. evita duplicidade por `event.id`
4. busca detalhes do pedido
5. normaliza e persiste pedido/tracking/evento
6. grava log

## Backend HTTP real

Servidor:

- `backend/server.js`

Rotas internas:

- `GET /api/health`
- `GET /api/integrations/ifood/merchants/:storeId`
- `POST /api/integrations/ifood/polling/run`
- `POST /api/integrations/ifood/orders/:storeId/:merchantId/:orderId/sync`

Webhook:

- `POST /webhooks/ifood/:storeId/:merchantId`

Observacao:

- o webhook nao depende do frontend
- o backend usa Firebase Admin
- a persistencia continua multi-loja por `storeId`

## Frontend

O frontend nao fala diretamente com a API do iFood.

Ele consome apenas Firestore pelos serviços:

- `src/services/externalOrders.js`
- `src/services/orders.js`

O módulo de pedidos mostra:

- origem do pedido
- status normalizado
- timeline de eventos
- tracking
- erros de sincronizacao

## Widget oficial

- `src/services/ifoodWidget.js`
- `src/components/integrations/IFoodWidgetBridge.jsx`

O widget fica desacoplado da logica principal.
O tracking interno continua persistido independentemente do widget.

## Configuracao por merchant

Salvar um documento em:

`stores/{storeId}/integration_merchants/{merchantId}`

Campos esperados:

- `source: "ifood"`
- `merchantId`
- `name`
- `clientId`
- `clientSecret`
- `webhookSecret`
- `webhookUrl`
- `pollingEnabled`
- `webhookEnabled`
- `trackingEnabled`
- `widgetEnabled`
- `widgetId`
- `widgetMerchantIds`
- `lastPollingAt`
- `lastWebhookAt`
- `lastSyncAt`
- `lastSyncError`
- `status`

## URLs e segredos

### Onde configurar

- env backend: `.env`
- merchant por loja: `integration_merchants`
- webhook URL: `IFOOD_WEBHOOK_URL` e `integration_merchants.webhookUrl`
- webhook secret: `IFOOD_WEBHOOK_SECRET` e `integration_merchants.webhookSecret`
- Firebase Admin: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`

## Futuras integracoes

O desenho suporta novos adapters sem mudar o frontend principal:

- `backend/integrations/anota-ai/...`
- `backend/integrations/ze-delivery/...`

Todos podem reutilizar:

- `external_orders`
- `external_order_events`
- `external_order_tracking`
- `integration_logs`
- `integration_merchants`
