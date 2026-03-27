# Contributing to Nexus10

## Objetivo

Este documento reduz o tempo de onboarding para novos desenvolvedores do Nexus10.
O projeto combina:

- frontend React 18 + Vite 5
- backend Express
- Firebase / Firestore
- integrações iFood
- Redis opcional para cache

## Requisitos Locais

Instale:

- Node.js 18 ou superior
- npm 9 ou superior
- Docker Desktop, se for usar Redis local
- Firebase CLI, se for publicar `firestore.rules` ou `firestore.indexes.json`

Verificações rápidas:

```bash
node -v
npm -v
docker -v
firebase --version
```

## Setup Local

1. Instale dependências:

```bash
npm install
```

2. Crie o `.env` a partir do `.env.example`.

```bash
copy .env.example .env
```

3. Preencha ao menos as variáveis de frontend Firebase:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_API_URL`

4. Se for rodar o backend completo, configure também:

- `FRONTEND_ORIGIN`
- `LOCAL_OPERATOR_PASSWORD`
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `IFOOD_WEBHOOK_SECRET` quando houver fluxo iFood real

5. Redis é opcional. Para subir localmente:

```bash
npm run redis:start
```

## Rodando o Projeto

Frontend:

```bash
npm run dev
```

Backend:

```bash
npm run dev:backend
```

Frontend + backend:

```bash
npm run dev:full
```

Storybook:

```bash
npm run storybook
```

Swagger UI:

```text
http://localhost:8787/api-docs
```

## Fluxo de Desenvolvimento

Fluxo recomendado:

1. Atualize sua branch local com `main`
2. Crie uma branch curta e descritiva
3. Implemente a mudança
4. Rode lint, testes e build
5. Abra PR para `main`

Convenção de branch sugerida:

- `feature/nome-curto`
- `fix/nome-curto`
- `refactor/nome-curto`
- `docs/nome-curto`

Convenção de commit sugerida:

- `feat(area): descricao`
- `fix(area): descricao`
- `refactor(area): descricao`
- `docs(area): descricao`
- `test(area): descricao`

Exemplos:

```bash
git checkout -b feature/openapi-docs
git commit -m "feat(api): add swagger ui"
```

## Padrões de Código

### Frontend

- prefira componentes pequenos e focados
- centralize fetch assíncrono em TanStack Query
- use os componentes de `src/components/ui/` antes de criar markup novo
- reuse serviços em `src/services/`
- quando houver validação, priorize Zod

### Backend

- valide entrada com `validateRequest(...)`
- use logger estruturado via Pino
- não confie em identidade enviada pelo cliente
- passe por `requireApiAuth` e `requireStoreAccess` nas rotas protegidas
- documente endpoints novos em `backend/swagger.js`

### TypeScript

- frontend já tem base TS habilitada
- backend está em migração gradual; novos arquivos centrais podem ser `.ts`
- mantenha tipos compartilhados em `src/types/` e `backend/types/`

## Testes e Qualidade

Antes de abrir PR, rode:

```bash
npm run lint
npm run test
npm run test:coverage
npm run build
npm run type-check
npm run type-check:backend
```

Meta atual:

- cobertura mínima alvo dos próximos sprints: `70%+`

## Deploy

### Frontend

O fluxo normal é via Vercel a partir do push para `main`.

Passos:

1. valide localmente
2. faça merge ou push para `main`
3. aguarde o deploy automático da Vercel

Deploy manual só em exceção:

```bash
npm run deploy:preview
npm run deploy:prod:manual
```

### Backend

Build do backend:

```bash
npm run build:backend
```

Execução do backend compilado:

```bash
npm run start:backend
```

### Firebase

Publicar regras:

```bash
npm run firebase:deploy:rules
```

Publicar índices:

```bash
npm run firebase:deploy:indexes
```

## Pull Requests

Todo PR deve incluir:

- resumo curto da mudança
- risco principal
- como validar
- screenshots quando houver impacto visual
- observações de deploy, se houver

Checklist recomendado:

- [ ] lint passou
- [ ] testes passaram
- [ ] build passou
- [ ] documentação atualizada
- [ ] swagger atualizado, se mudou API
- [ ] índices ou regras Firebase atualizados, se mudou Firestore

## Segurança e Operação

- nunca suba `.env`
- não reative `legacy/` no fluxo principal
- confirme `FRONTEND_ORIGIN` em produção
- use `LOCAL_OPERATOR_PASSWORD` forte
- se adicionar rota nova, revise auth, rate limit e validação

Referências úteis:

- [README.md](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\README.md)
- [docs/deploy-flow.md](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\docs\deploy-flow.md)
- [docs/security-audit-2026-03-25.md](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\docs\security-audit-2026-03-25.md)
