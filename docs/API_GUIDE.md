# Nexus10 API Guide

## Base URL

Ambiente local do backend:

```text
http://localhost:8787
```

Prefixo principal:

```text
/api
```

Documentação Swagger:

- `GET /api-docs`
- `GET /api-docs.json`

## Autenticação

O backend usa token Firebase no header:

```http
Authorization: Bearer <firebase-id-token>
```

Exceções:

- `GET /api/health`
- `POST /api/auth/session`
- `POST /webhooks/ifood/{storeId}/{merchantId}`
- `GET /api-docs`
- `GET /api-docs.json`

## Auth Flow

### 1. Criar sessão operacional

`POST /api/auth/session`

Request:

```json
{
  "operator": "Gabriel",
  "pin": "0101",
  "storeId": "loja-centro"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "token": "firebase-custom-token",
    "profile": {
      "id": "gabriel",
      "name": "Gabriel",
      "role": "admin",
      "storeIds": ["loja-centro"]
    }
  }
}
```

### 2. Login Firebase no frontend

O frontend usa o custom token retornado para obter um ID token Firebase.

### 3. Requests autenticadas

O frontend passa o ID token nas chamadas do backend.

## Endpoints Principais

## Health

### `GET /api/health`

Verifica disponibilidade do backend.

## Auth

### `POST /api/auth/session`

Cria sessão operacional.

## Orders

### `POST /api/stores/{storeId}/orders`

Cria pedido.

Campos principais:

- `code`
- `source`
- `customer`
- `items`
- `totals`
- `createdBy`

### `PATCH /api/stores/{storeId}/orders/{orderId}`

Atualiza pedido existente.

### `DELETE /api/stores/{storeId}/orders/{orderId}`

Exclui pedido quando permitido pela regra de negócio.

### `POST /api/stores/{storeId}/orders/{orderId}/dispatch`

Marca pedido como despachado.

### `POST /api/stores/{storeId}/orders/{orderId}/convert-to-sale`

Converte pedido em venda.

## Sales

### `POST /api/stores/{storeId}/sales`

Cria venda direta.

### `POST /api/stores/{storeId}/orders/{orderId}/sales`

Cria venda vinculada a pedido.

### `PATCH /api/stores/{storeId}/sales/{saleId}/status`

Atualiza status da venda.

### `DELETE /api/stores/{storeId}/sales/{saleId}`

Remove venda quando permitido.

## Assistant

### `POST /api/stores/{storeId}/assistant/query`

Executa consulta do assistente operacional.

## Audit Logs

### `GET /api/admin/audit-logs`

Disponível apenas para admin.

Query params principais:

- `page`
- `limit`
- `actor`
- `action`
- `resource`
- `dateFrom`
- `dateTo`

Exemplo:

```text
/api/admin/audit-logs?page=1&limit=50&actor=Gabriel&action=CREATE&resource=orders
```

## Integração iFood

### `GET /api/integrations/ifood/merchants/{storeId}`

Lista merchants iFood mapeados para a loja.

### `POST /api/integrations/ifood/polling/run`

Dispara polling manual de eventos iFood.

Request:

```json
{
  "storeId": "loja-centro",
  "merchantId": "ifood-merchant-001"
}
```

### `POST /api/integrations/ifood/orders/{storeId}/{merchantId}/{orderId}/sync`

Sincroniza uma ordem específica do iFood.

## Webhooks

### `POST /webhooks/ifood/{storeId}/{merchantId}`

Recebe eventos externos do iFood.

Headers relevantes:

- `x-ifood-signature`
- `content-type`

Body:

- texto bruto recebido do provedor

## Padrão de Resposta

### Sucesso

Nem todas as rotas históricas seguem exatamente o mesmo envelope, mas o padrão alvo é:

```json
{
  "success": true,
  "data": {}
}
```

### Erro

Erros comuns:

```json
{
  "error": "Dados de entrada invalidos.",
  "code": "VALIDATION_ERROR",
  "details": {
    "operator": ["operator e obrigatorio."]
  }
}
```

## Rate Limits

A API já tem rate limit configurado no backend.

Parâmetros padrão atuais:

- janela global: `15 minutos`
- limite global: `300 requests por IP`
- login: limite mais restritivo usando `AUTH_RATE_LIMIT_MAX`

Variáveis relevantes:

- `API_RATE_LIMIT_WINDOW_MS`
- `API_RATE_LIMIT_MAX`
- `AUTH_RATE_LIMIT_MAX`

Quando o limite é excedido, a API retorna erro com mensagem:

```json
{
  "error": "Limite de requisicoes excedido. Aguarde antes de tentar novamente."
}
```

## Regras de Acesso

- rotas sob `/api/admin/*` exigem `admin`
- rotas sob `/api/stores/:storeId/*` exigem acesso à loja
- webhooks externos não usam bearer token, mas devem validar assinatura e origem

## Boas Práticas para Consumidores da API

- sempre enviar `Authorization` nas rotas protegidas
- não depender de campos históricos não documentados
- usar paginação quando a rota expuser `page` e `limit`
- usar `GET /api-docs` como referência principal da spec atual

## Referências

- [backend/swagger.js](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\backend\swagger.js)
- [backend/app.ts](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\backend\app.ts)
