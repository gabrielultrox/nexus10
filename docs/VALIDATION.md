# Backend Validation

O backend do Nexus10 usa `Zod` para validar entrada antes do handler de negocio.

## Objetivo

Nenhuma rota protegida por `validateRequest(...)` ou `validateRequestSources(...)` deve receber payload cru dentro do handler.

Arquivos centrais:

- `backend/schemas/validation.js`
- `backend/middleware/validateRequest.js`
- `backend/errors/RequestValidationError.js`

## Schemas disponiveis

### Auth

- `authLoginSchema`
  - `POST /api/auth/login`
  - aceita `pin`, `operator`, `storeId`
  - tambem aceita aliases legados `password` e `operatorName`
- `authSessionSchema`
  - `POST /api/auth/session`
  - valida `{ token }`
- `authSessionRouteSchema`
  - mantem compatibilidade com o contrato legado de login em `/api/auth/session`
  - aceita login ou token

### Orders

- `createOrderSchema`
  - `POST /api/stores/:storeId/orders`
- `updateOrderSchema`
  - `PATCH /api/stores/:storeId/orders/:orderId`

### Finance

- `createFinancialTransactionSchema`
  - `POST /api/finance/entries`
- `createFinancialClosureSchema`
  - `POST /api/finance/closures`

### iFood

- `ifoodWebhookSchema`
  - `POST /webhooks/ifood/:storeId/:merchantId`

## Middleware

### `validateRequest(schema, options?)`

Valida uma unica fonte do request.

Opcoes:

- `source`: `body`, `params`, `query`, ou qualquer chave customizada
- `targetKey`: nome salvo em `request.validated`
- `mapRequest(request)`: adapta payload antes da validacao

Exemplo:

```js
app.post('/api/auth/login', validateRequest(authLoginSchema), async (request, response) => {
  const payload = request.validated.body
  response.json({ data: payload })
})
```

### `validateRequestSources(config)`

Valida multiplas fontes no mesmo middleware.

Exemplo:

```js
app.post(
  '/webhooks/ifood/:storeId/:merchantId',
  validateRequestSources({
    params: {
      schema: ifoodOrderSyncParamsSchema,
      source: 'params',
    },
    webhook: {
      schema: ifoodWebhookSchema,
      source: 'webhook',
      mapRequest: (request) => ({
        signature: request.header('X-IFood-Signature'),
        body: String(request.body ?? ''),
      }),
    },
  }),
  handler,
)
```

## Erro padrao

Falhas de validacao geram `RequestValidationError` e o middleware global responde `400`.

Formato:

```json
{
  "error": "Falha de validacao em body.",
  "code": "VALIDATION_ERROR",
  "source": "body",
  "details": {
    "operator": ["operator e obrigatorio."]
  }
}
```

## Rotas integradas

Exemplos reais no backend atual:

- `backend/modules/auth/authController.ts`
  - `POST /api/auth/login`
  - `POST /api/auth/session`
- `backend/modules/orders/orderController.js`
  - `POST /api/stores/:storeId/orders`
  - `PATCH /api/stores/:storeId/orders/:orderId`
- `backend/modules/finance/financeController.js`
  - `POST /api/finance/entries`
  - `POST /api/finance/closures`
- `backend/app.ts`
  - `POST /webhooks/ifood/:storeId/:merchantId`

## Regra operacional

Ao adicionar rota nova:

1. criar ou reaproveitar schema em `backend/schemas/validation.js`
2. ligar `validateRequest(...)` ou `validateRequestSources(...)`
3. consumir `request.validated`
4. cobrir ao menos um caso valido e um invalido em teste
