# Environment

O Nexus10 falha no boot se a configuracao obrigatoria estiver ausente ou invalida.

## Precedencia

Backend:

1. `.env.<ambiente>.local`
2. `.env.local`
3. `.env.<ambiente>`
4. `.env`

Frontend:

- o Vite resolve `.env`, `.env.local`, `.env.[mode]` e `.env.[mode].local` automaticamente
- a validacao acontece no boot do app em `src/config/env.ts`

Ambientes aceitos:

- `dev` ou `development`
- `staging`
- `prod` ou `production`
- `test`

## Backend

Arquivo principal:

- `backend/config/env.js`

Variaveis obrigatorias:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

Obrigatorias em producao:

- `FRONTEND_ORIGIN`
- `LOCAL_OPERATOR_PASSWORD`

Defaults relevantes:

- `PORT=3001`
- `API_RATE_LIMIT_MAX=100`
- `API_RATE_LIMIT_WINDOW_MS=60000`
- `LOG_LEVEL=info`

## Frontend

Arquivo principal:

- `src/config/env.ts`

Variaveis obrigatorias:

- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_API_KEY`
- `VITE_API_BASE_URL`

Defaults:

- `VITE_LOG_LEVEL=info`

## Fail fast

Exemplo de erro:

```text
Falha ao validar variaveis de ambiente do backend.
- FIREBASE_ADMIN_PROJECT_ID: FIREBASE_ADMIN_PROJECT_ID e obrigatoria.
```

## Arquivos de exemplo

- `.env.example`: baseline compartilhada
- `.env.local.example`: overrides locais para desenvolvimento

Copie os exemplos para:

- `.env`
- `.env.local`

e preencha os valores reais antes de subir o app.
