# Nexus 10 Seguro

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

## Scripts

```bash
npm run dev            # frontend Vite
npm run dev:backend    # backend Express com watch
npm run dev:full       # frontend + backend juntos
npm run build          # build de producao do frontend
npm run preview        # preview do build
npm run start:backend  # sobe o backend sem watch
```

## Observacoes

- O projeto possui fallback local quando o Firebase nao esta configurado.
- O arquivo `.env` esta ignorado no Git e nao foi publicado.
- O repositório foi preparado para desenvolvimento local e pode ser expandido com deploy separado para frontend e backend.
