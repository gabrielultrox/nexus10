# Backend Security

O backend Express do Nexus10 centraliza a politica HTTP em:

- `backend/config/security.js`

O bootstrap principal aplica essa configuracao em:

- `backend/app.ts`

## O que esta ativo

### CORS estrito

- apenas as origens de `FRONTEND_ORIGIN`
- credenciais habilitadas com `Access-Control-Allow-Credentials: true`
- preflight cacheado com `Access-Control-Max-Age`
- headers e metodos explicitamente declarados

Em desenvolvimento, `localhost:5173` e `127.0.0.1:5173` continuam aceitos para nao quebrar o fluxo local.

### Headers de seguranca

Via `helmet` + header manual:

- `Strict-Transport-Security`
- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`

Tambem:

- `X-Powered-By` removido

### Validacoes adicionais

- blacklist de `User-Agent` para scanners conhecidos
- validador customizado de origin
- enforcement de HTTPS em producao com base em `req.secure` e `x-forwarded-proto`

## Variaveis de ambiente

### Obrigatorias

- `FRONTEND_ORIGIN`

### Opcionais

- `CORS_PREFLIGHT_MAX_AGE_SECONDS`
- `SECURITY_USER_AGENT_BLOCKLIST`

Exemplo:

```env
FRONTEND_ORIGIN=https://nexus10-seguro-copia-2026-03-092036.vercel.app
CORS_PREFLIGHT_MAX_AGE_SECONDS=600
SECURITY_USER_AGENT_BLOCKLIST=sqlmap,nikto,masscan,zgrab,acunetix
```

## Fluxo da protecao

Ordem aplicada no backend:

1. `requestLogger`
2. `createUserAgentGuard()`
3. `createSecurityHeadersMiddleware()`
4. `createHttpsEnforcementMiddleware()`
5. `createCorsProtectionMiddleware()`

Isso garante que requests suspeitas ou inseguras sejam barradas cedo.

## Comportamento esperado

### Origem invalida

Resposta:

```json
{
  "error": "Origem nao autorizada para esta API."
}
```

Status:

- `403`

### User-Agent bloqueado

Resposta:

```json
{
  "error": "User-Agent bloqueado pela politica de seguranca."
}
```

Status:

- `403`

### HTTP em producao

Resposta:

```json
{
  "error": "HTTPS obrigatorio neste ambiente."
}
```

Status:

- `426`

## Testes

Cobertura automatizada em:

- `backend/__tests__/security.test.js`

Casos cobertos:

- headers de seguranca enviados
- CORS rejeita origem invalida
- preflight aceita origem valida
- HTTPS obrigatorio em producao
- blacklist de `User-Agent`

## Observacoes operacionais

- para `HSTS` e `req.secure` funcionarem corretamente em producao, o proxy reverso deve enviar `X-Forwarded-Proto: https`
- `app.set('trust proxy', true)` ja esta habilitado no bootstrap
- se o frontend publicado mudar, `FRONTEND_ORIGIN` precisa ser atualizada antes do deploy
