# Deployment Checklist

## Firebase

- Projeto ativo: `nexus-af413`
- Authentication: `Anonymous` ativado
- Publicar regras e indexes:
  - `npm run firebase:login`
  - `npm run firebase:deploy:rules`
  - `npm run firebase:deploy:indexes`

## Frontend

- Provedor sugerido: `Vercel`
- Framework detectado: `Vite`
- Variaveis necessarias no projeto:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
  - `VITE_API_BASE_URL`

## Backend

- Provedor sugerido: `Render`
- Blueprint pronto em `render.yaml`
- Variaveis necessarias no servico:
  - `PORT=8787`
  - `NODE_ENV=production`
  - `FRONTEND_ORIGIN=<url do frontend publicado>`
  - `FIREBASE_ADMIN_PROJECT_ID`
  - `FIREBASE_ADMIN_CLIENT_EMAIL`
  - `FIREBASE_ADMIN_PRIVATE_KEY`

## Ordem sugerida

1. Publicar backend no Render
2. Copiar URL publica do backend
3. Configurar `VITE_API_BASE_URL` no frontend
4. Publicar frontend no Vercel
5. Atualizar `FRONTEND_ORIGIN` no backend com a URL final do frontend
6. Testar em dois computadores
