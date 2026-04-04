# Runbook: Erro de Deploy

## Sintoma

- CI falha no GitHub Actions.
- Deploy da Vercel nao fica `Ready`.
- App publicado sobe, mas quebra no boot.

## Como diagnosticar

1. Rodar validacoes locais minimas:

```bash
npm run lint
npm run test
npm run test:coverage
npm run type-check
npm run type-check:backend
npm run build
```

2. Se houver alteracao de Firestore, validar artefatos:

```bash
npm run firebase:deploy:rules
npm run firebase:deploy:indexes
```

3. Conferir se o problema e CI ou deploy:

- CI: GitHub Actions
- Deploy: Vercel / `vercel inspect --logs`

4. Se precisar publicar manualmente:

```bash
npm run deploy:preview
npm run deploy:prod:manual
```

5. Validar o endpoint de health apos o deploy:

```bash
curl https://SEU_BACKEND/api/health
```

## Ação imediata

- Se a falha for em teste, corrigir a regressao antes de novo deploy.
- Se a falha for apenas variavel de ambiente ausente, restaurar o conjunto valido e redeployar.
- Se a falha for na Vercel por configuracao, corrigir `vercel.json` ou variaveis e disparar novo deploy.

## Rollback / mitigação

- Promover o ultimo deploy estavel ou reverter o commit que introduziu a falha.
- Em mudanca arriscada, congelar novos merges ate o ambiente voltar a `Ready`.
- Se o problema for apenas frontend, manter backend no ar e reverter o deploy da interface.

## Quando escalar

- Escalar se producao ficar indisponivel por mais de 15 minutos.
- Escalar se nao houver deploy estavel disponivel para rollback.
- Escalar se o erro envolver credenciais, billing ou infraestrutura externa fora do repo.
