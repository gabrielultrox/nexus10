# Nexus10

Aplicacao operacional para loja com frontend em React/Vite, backend em Express e integracoes com Firebase e iFood.

## Visao Geral

O projeto combina uma interface operacional modular com:

- dashboard operacional
- pedidos, vendas, clientes, produtos e estoque
- autenticacao local com PIN e perfis por papel
- persistencia local com fallback para Firestore
- backend dedicado para integracao com iFood

## Stack

- React 18
- Vite 5
- React Router 6
- Express 4
- Firebase / Firestore
- Firebase Admin

## Estrutura

```text
src/        frontend React
backend/    servidor Express e integracoes iFood
public/     assets estaticos
docs/       documentacao auxiliar
scripts/    scripts utilitarios
```

## Requisitos

- Node.js 18+
- npm
- projeto Firebase configurado, se quiser usar dados remotos

## Configuracao

1. Instale as dependencias:

```bash
npm install
```

2. Crie o arquivo `.env` com base em `.env.example`.

3. Preencha as variaveis de frontend (`VITE_FIREBASE_*`) e, se for usar o backend do iFood, tambem as variaveis de backend.

## Checklist de Producao

Antes de publicar o backend em producao, configure obrigatoriamente:

- `FRONTEND_ORIGIN` com a URL exata do frontend publicado
- `LOCAL_OPERATOR_PASSWORD` com um segredo real
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

Configuracoes recomendadas:

- `API_RATE_LIMIT_WINDOW_MS`
- `API_RATE_LIMIT_MAX`
- `AUTH_RATE_LIMIT_MAX`
- `IFOOD_WEBHOOK_SECRET`

Nao publique com fallback de desenvolvimento ou senha operacional fraca.

## Scripts

```bash
npm run dev            # frontend Vite
npm run dev:backend    # backend Express com watch
npm run dev:full       # frontend + backend juntos
npm run build          # build de producao do frontend
npm run preview        # preview do build
npm run deploy:preview # preview manual na Vercel
npm run deploy:prod:manual # deploy manual de producao, usar so em emergencia
npm run start:backend  # sobe o backend sem watch
```

## Deploy

Fluxo padrao:

1. rode `npm run lint`
2. rode `npm run build`
3. faca `git push origin main`
4. deixe a Vercel publicar automaticamente a partir do GitHub

O deploy manual de producao deve ser excecao. Detalhes em [docs/deploy-flow.md](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\docs\deploy-flow.md).

## Observacoes

- O projeto possui fallback local quando o Firebase nao esta configurado.
- O arquivo `.env` esta ignorado no Git e nao foi publicado.
- O repositorio foi preparado para desenvolvimento local e pode ser expandido com deploy separado para frontend e backend.
- `legacy/` e somente arquivo morto de referencia. Nao entra em `dist/`, nao entra no deploy da Vercel e nao faz parte do fluxo operacional atual.
- `legacy/` nao deve ser distribuido nem modificado; a plataforma tambem ignora `legacy/` via `.vercelignore`.
- O resumo da ultima rodada de endurecimento de seguranca esta em [docs/security-audit-2026-03-25.md](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\docs\security-audit-2026-03-25.md).
