# CI/CD do Nexus10

## Visao geral

O repositório usa GitHub Actions para validar qualidade, testes e build em toda alteração relevante. O fluxo principal fica em:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-preview.yml`

## Workflow principal: CI

Trigger:

- `push` para `main`
- `pull_request`

Objetivos:

- validar lint
- separar testes de backend e frontend
- gerar cobertura com gate minimo de `70%`
- validar build de frontend
- publicar artifacts de cobertura e bundle
- comentar status no PR

## Jobs do CI

### 1. Lint

Roda em matriz:

- Node `18`
- Node `20`

Executa:

- `npm run lint`
- `npm run format:check`

Cobertura do job:

- ESLint no código frontend
- Prettier em todo o repositório

### 2. Backend tests

Roda em matriz:

- Node `18`
- Node `20`

Executa:

- `npm run test:backend`

Isso limita o Vitest ao diretório `backend`.

### 3. Frontend tests

Roda em matriz:

- Node `18`
- Node `20`

Executa:

- `npm run test:frontend`

Isso limita o Vitest ao diretório `src`.

### 4. Coverage gate

Roda em:

- Node `20`

Executa:

- `npm run test:coverage`

Comportamento:

- usa `v8` provider
- publica artifact `coverage-report`
- falha automaticamente se qualquer métrica ficar abaixo de `70%`

Arquivo fonte do gate:

- `vitest.config.ts`

### 5. Build frontend

Roda em matriz:

- Node `18`
- Node `20`

Executa:

- `npm run build`

No Node `20`, também executa:

- `npm run analyze:bundle`

Artifact publicado:

- `bundle-analysis`

## Comentario automatico em PR

No fim do workflow, o job `pr-comment` publica ou atualiza um comentário com:

- resultado do lint
- resultado dos testes backend
- resultado dos testes frontend
- resultado do build
- resultado do gate de cobertura
- resumo das métricas
- artifacts gerados

## Workflow opcional: preview deploy

Arquivo:

- `.github/workflows/deploy-preview.yml`

Trigger:

- `pull_request`

Objetivo:

- construir preview na Vercel
- comentar a URL no PR

## Secrets esperados

O CI principal nao exige secrets especiais.

O preview deploy exige:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Secrets recomendados para evolucao futura:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `SENTRY_AUTH_TOKEN`
- `FIREBASE_TOKEN`

## Scripts usados

Os workflows dependem destes scripts:

- `npm run lint`
- `npm run format:check`
- `npm run test:backend`
- `npm run test:frontend`
- `npm run test:coverage`
- `npm run build`
- `npm run analyze:bundle`

## Artifacts

Artifacts publicados pelo CI:

- `coverage-report`
  - relatorios de cobertura do Vitest
- `bundle-analysis`
  - `output/bundle-report.html`

## Fluxo recomendado

1. Abrir branch de trabalho
2. Rodar localmente:
   - `npm run lint`
   - `npm run test:backend`
   - `npm run test:frontend`
   - `npm run test:coverage`
   - `npm run build`
3. Abrir PR
4. Conferir comentário do CI
5. Baixar artifacts quando precisar depurar cobertura ou bundle
6. Fazer merge só com CI verde

## Observacoes

- o gate de cobertura está formalizado no Vitest, nao no workflow
- o workflow apenas executa e publica o resultado
- a matriz 18/20 serve para detectar incompatibilidades cedo
