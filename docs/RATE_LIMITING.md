# Rate Limiting

O backend do Nexus10 usa rate limiting granular com `express-rate-limit`.

Arquivo principal:

- `backend/middleware/rateLimiter.js`

## Limites ativos

### Auth

- `POST /api/auth/login`
- `POST /api/auth/session`

Regra:

- `5` tentativas por `15 min` por IP

Chave:

- `request.ip`

### API autenticada

Aplicado depois de `requireApiAuth`:

- `100` requisicoes por `1 min` por usuario autenticado

Chave:

- `request.authUser.uid`
- fallback para IP se o contexto autenticado nao existir

### Webhook de merchant

- `POST /webhooks/merchant/:storeId/:merchantId`

Regra:

- `50` requisicoes por `1 min` por merchant

Chave:

- `${storeId}:${merchantId}`

### Uploads

Namespace reservado:

- `/api/uploads/*`

Regra:

- `10` uploads por `1 hora` por usuario

Observacao:

- hoje o app ainda nao tem rota de upload publicada nesse namespace
- o limite ja fica pronto para qualquer endpoint novo em `/api/uploads`

### Endpoints publicos

Aplicado em:

- `GET /api/health`
- `GET /api-docs`
- `GET /api-docs.json`

Regra:

- `30` requisicoes por `1 min` por IP

## Stores

### Development

- store em memoria

### Production

- store Redis quando `REDIS_URL` estiver configurada
- fallback automatico para memoria se Redis cair

## Headers

As respostas incluem headers de rate limit:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `RateLimit-Policy`
- `RateLimit-Remaining`
- `RateLimit-Reset`

Quando o limite estoura:

- status `429`
- header `Retry-After`

Resposta:

```json
{
  "error": "Limite de requisicoes excedido para esta rota.",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limiter": "login",
    "retryAfterSeconds": 900,
    "limit": 5
  }
}
```

## Trusted IPs

IPs confiaveis nao sofrem bloqueio:

- loopback
- ranges privados RFC1918
- lista manual em `RATE_LIMIT_TRUSTED_IPS`

Exemplo:

```env
RATE_LIMIT_TRUSTED_IPS=10.0.0.10,10.0.0.11,192.168.0.20
```

## Integracao no app

O encadeamento atual em `backend/app.ts` fica assim:

1. `requestLogger`
2. hardening de seguranca
3. parsing JSON/text
4. rate limiting por grupo de rota
5. auth
6. rate limiting da API autenticada
7. handlers

Isso garante:

- login limitado antes do handler de auth
- webhook limitado antes de processar assinatura e carga
- API autenticada limitada por usuario, nao por IP compartilhado

## Testes

Casos cobertos em:

- `backend/rateLimiter.test.js`

Cobertura:

- limite de login por IP
- limite da API por usuario autenticado
- limite de webhook por merchant
- limite de upload por usuario
- bypass para IP interno confiavel
