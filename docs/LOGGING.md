# Logging no backend Nexus10

## Objetivo

O backend usa `Pino` como logger padrão. O objetivo é ter logs estruturados, consistentes e úteis para:

- troubleshooting
- auditoria operacional
- monitoramento
- correlação por requisição

## Arquivos principais

- `backend/config/logger.js`
- `backend/middleware/requestLogger.js`
- `backend/logging/logger.js`

## Níveis de log

- `trace`
  - detalhes muito finos de execução
  - usar só em diagnóstico pontual
- `debug`
  - início/fim de métodos, payloads técnicos não sensíveis
- `info`
  - fluxo normal de negócio e requests bem-sucedidos
- `warn`
  - falhas recuperáveis, entrada inválida, situação inesperada mas controlada
- `error`
  - falhas operacionais relevantes
- `fatal`
  - falhas críticas que comprometem o processo

## Transporte por ambiente

### Development

- saída no console
- cores via `pino-pretty`
- formato legível para debug rápido

### Production

- saída em arquivo JSON lines
- diretório: `backend/logs/`
- rotação diária automática
- padrão de nome:
  - `nexus10-backend-YYYY-MM-DD.jsonl`

## Contexto automático

O middleware de request adiciona:

- `request_id`
- `timestamp`
- `method`
- `route`
- `ip_address`
- `user_id` quando disponível

Também registra:

- status HTTP
- tempo de resposta em `duration_ms`

## Middleware Express

Arquivo:

- `backend/middleware/requestLogger.js`

Ele registra por request:

- método
- rota
- status
- tempo
- IP
- usuário autenticado

## Wrapper para métodos

Arquivo:

- `backend/config/logger.js`

Função:

- `withMethodLogging(config, handler)`

Uso recomendado:

- adapters HTTP
- integração externa
- operações de serviço com latência relevante

Exemplo:

```js
const runSync = withMethodLogging(
  {
    logger: serviceLogger,
    action: 'orders.sync',
    getStartPayload: ({ orderId }) => ({ order_id: orderId }),
  },
  async ({ orderId }) => {
    return syncOrder(orderId)
  },
)
```

## Exemplos reais do projeto

### App / middleware

- `backend/app.ts`
- `backend/middleware/requestLogger.js`

### Auth

- `GET /api/auth/operators`
- `POST /api/auth/session`

Arquivo:

- `backend/modules/auth/authController.ts`

## Scripts úteis

- `npm run logs:list`
  - lista os arquivos em `backend/logs`
- `npm run logs:tail`
  - acompanha o arquivo de log mais recente
- `npm run logs:clean`
  - limpa os logs locais

## Boas práticas

- não usar `console.log` no backend
- não logar segredos
  - tokens
  - `clientSecret`
  - senhas
- preferir chaves estáveis em snake_case para campos estruturados
- incluir `context` ou `action` em logs de negócio
- usar `warn` para falhas esperadas e `error` para falhas reais
- sempre serializar exceções com `serializeError`

## O que evitar

- logar body inteiro de autenticação
- logar headers sensíveis
- logar payloads muito grandes em loops
- usar `error` para estados de validação controlados
