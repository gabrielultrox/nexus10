# Nexus10 Deployment Guide

## Objetivo

Este documento define o processo de deployment para produção do Nexus10, cobrindo pré-checks, variáveis obrigatórias, estratégia de backup e rollback.

## Topologia Atual

- frontend: Vercel
- backend: Express serverless/Node
- banco principal: Firestore
- cache opcional: Redis
- monitoramento: Sentry + dashboard admin + alertas Discord

## Pre-Deployment Checklist

Antes de publicar:

- [ ] `main` está estável e revisada
- [ ] `npm run lint` passou
- [ ] `npm run test` passou
- [ ] `npm run test:coverage` passou
- [ ] `npm run build` passou
- [ ] `npm run type-check`
- [ ] `npm run type-check:backend`
- [ ] Swagger atualizado se houve mudança de API
- [ ] `firestore.rules` revisado se houve mudança de acesso
- [ ] `firestore.indexes.json` atualizado se houve mudança de query
- [ ] variáveis de ambiente conferidas no ambiente alvo
- [ ] deploy de preview validado quando a mudança for arriscada
- [ ] rollback plan definido

## Environment Variables Necessárias

## Frontend

Obrigatórias:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_API_BASE_URL`

## Backend

Obrigatórias:

- `PORT`
- `NODE_ENV=production`
- `FRONTEND_ORIGIN`
- `LOCAL_OPERATOR_PASSWORD`
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

Obrigatórias para segurança e observabilidade:

- `LOG_LEVEL`
- `SENTRY_DSN`
- `SENTRY_RELEASE`
- `ALERT_DISCORD_WEBHOOK_URL`
- `API_RATE_LIMIT_WINDOW_MS`
- `API_RATE_LIMIT_MAX`
- `AUTH_RATE_LIMIT_MAX`

Obrigatórias para iFood, se a integração estiver ativa:

- `IFOOD_AUTH_BASE_URL`
- `IFOOD_MERCHANT_BASE_URL`
- `IFOOD_EVENTS_POLLING_PATH`
- `IFOOD_EVENTS_ACK_PATH`
- `IFOOD_ORDER_DETAILS_PATH`
- `IFOOD_WEBHOOK_URL`
- `IFOOD_WEBHOOK_SECRET`
- `IFOOD_POLLING_INTERVAL_SECONDS`

Opcional, mas recomendado:

- `REDIS_URL`
- `REDIS_KEY_PREFIX`
- `REDIS_SESSION_TTL_SECONDS`
- `REDIS_MERCHANT_TTL_SECONDS`
- `REDIS_PRODUCT_TTL_SECONDS`

Referência:

- [.env.example](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\.env.example)

## Database Migrations (Firestore)

Firestore não usa migrations SQL tradicionais. No Nexus10, a disciplina correta é:

1. atualizar índices quando uma query nova exige composição
2. revisar regras quando a superfície de acesso muda
3. validar compatibilidade retroativa do shape dos documentos

## Deploy de índices

```bash
npm run firebase:deploy:indexes
```

## Deploy de regras

```bash
npm run firebase:deploy:rules
```

## Estratégia segura para mudanças de schema

- prefira mudanças aditivas
- mantenha leitura backward-compatible por pelo menos um ciclo de deploy
- só remova campos antigos depois de confirmar que nenhum fluxo depende deles
- quando precisar backfill, rode script controlado e auditável

## Sequência Recomendada de Deploy

1. rodar validações locais
2. publicar regras/índices Firestore se necessário
3. atualizar variáveis do backend
4. atualizar variáveis do frontend
5. fazer `git push origin main`
6. acompanhar CI e deploy da Vercel
7. validar health checks
8. validar fluxos críticos em produção

## Backup Strategy

## Firestore

Recomendado:

- export diário automático do Firestore para bucket GCS
- retenção mínima de 7 a 30 dias
- nomear exports por timestamp e ambiente

Comando típico via GCloud:

```bash
gcloud firestore export gs://SEU_BUCKET/firestore-backups/$(date +%Y-%m-%d)
```

## Configurações críticas

Manter cópia segura de:

- `.env` de produção no secret manager do provedor
- regras Firestore
- índices Firestore
- credenciais de serviço

## Redis

Redis no Nexus10 é cache, não fonte de verdade.

Regra:

- não depende de backup para restore funcional
- em incidente, pode ser limpo e reconstruído a partir de Firestore

## Rollback Procedure

## Caso 1: frontend quebrou

1. promover deploy anterior na Vercel
2. confirmar que `main` atual não está sendo servido
3. validar frontend carregando e autenticando

## Caso 2: backend quebrou

1. restaurar versão anterior do serviço/serverless
2. revalidar `/api/health`
3. revalidar login, orders e sales

## Caso 3: índice/regra Firestore causou incidente

1. reaplicar `firestore.rules` anterior
2. reaplicar `firestore.indexes.json` anterior
3. aguardar propagação
4. revalidar leitura e escrita nas rotas críticas

## Caso 4: rollout parcial com dados incompatíveis

1. interromper deploy
2. congelar mutações críticas se necessário
3. rodar script de reversão/backfill
4. restaurar versão anterior da aplicação

## Exemplo de GitHub Actions para Deploy Automático

Exemplo mínimo de workflow para deploy em produção após CI:

```yaml
name: Deploy Production

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install
        run: npm ci

      - name: Validate
        run: |
          npm run lint
          npm run test:coverage
          npm run build

      - name: Deploy Firestore rules
        if: ${{ secrets.FIREBASE_TOKEN != '' }}
        run: npx firebase deploy --only firestore:rules,firestore:indexes --token "${{ secrets.FIREBASE_TOKEN }}"

      - name: Deploy Vercel Production
        run: npx vercel --prod --token "${{ secrets.VERCEL_TOKEN }}"
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

Observação:

- se o fluxo principal continuar sendo GitHub -> Vercel automático, esse workflow pode ser usado só para validação e publicação de regras/índices

## Health Check Endpoints

Atualmente:

- `GET /api/health`
- `GET /api-docs`
- `GET /api-docs.json`

Recomendação de uso:

- load balancer / monitor externo deve usar `GET /api/health`
- Swagger não substitui health check

Resposta esperada de `GET /api/health`:

```json
{
  "status": "ok",
  "service": "nexus-ifood-integration",
  "timestamp": "2026-03-27T15:00:00.000Z"
}
```

## Validação Pós-Deploy

Depois do deploy:

- [ ] `GET /api/health` responde `200`
- [ ] login operacional funciona
- [ ] pedidos podem ser criados
- [ ] vendas podem ser criadas
- [ ] webhook iFood não retorna erro
- [ ] Sentry recebe evento de teste quando necessário
- [ ] dashboard admin de monitoramento está acessível

Referências:

- [docs/deploy-flow.md](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\docs\deploy-flow.md)
- [docs/security-audit-2026-03-25.md](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\docs\security-audit-2026-03-25.md)
