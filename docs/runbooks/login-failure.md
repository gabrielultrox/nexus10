# Runbook: Falha de Login

## Sintoma

- Operador nao consegue entrar no app.
- Login retorna erro em `/api/auth/login` ou `/api/auth/session`.
- Tela fica em loading ou responde `401`, `403` ou `429`.

## Como diagnosticar

1. Validar se o backend esta respondendo:

```bash
curl http://127.0.0.1:8787/api/health
```

2. Rodar a suite de auth do backend:

```bash
npm run test:backend
```

3. Confirmar variaveis minimas de auth no ambiente:

- `LOCAL_OPERATOR_PASSWORD`
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

4. Verificar se houve rate limit de login:

```bash
npm run logs:tail
```

5. Se for ambiente local, subir backend isolado para reproduzir:

```bash
npm run dev:backend
```

## Ação imediata

- Se o backend estiver fora do ar, restaurar o processo backend antes de qualquer outra analise.
- Se o erro for `429`, aguardar a janela de rate limit ou testar de outro IP apenas para diagnostico.
- Se o erro for credencial invalida de operador, corrigir `LOCAL_OPERATOR_PASSWORD` no ambiente alvo.
- Se o erro for token/Firebase, validar as credenciais do Admin SDK e reiniciar o backend.

## Rollback / mitigação

- Reaplicar o ultimo conjunto valido de variaveis de ambiente.
- Se o incidente começou apos deploy, fazer rollback do deploy e validar login novamente.
- Se o problema for apenas local, usar `.env.local.example` como base e reconstruir o `.env.local`.

## Quando escalar

- Escalar se `/api/health` estiver ok, mas nenhum operador conseguir autenticar.
- Escalar se houver erro recorrente de Firebase Admin mesmo com credenciais validas.
- Escalar se o login falhar em producao por mais de 15 minutos.
