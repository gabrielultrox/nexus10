# Backend TypeScript Migration

## Fase 1

Escopo desta fase:

- `backend/app.ts`
- `backend/config/env.ts`
- `backend/config/logger.ts`
- `backend/types/index.ts`

Objetivo:

- tipar o core do backend
- manter compatibilidade com os modulos `.js` ainda nao migrados
- preservar o fluxo atual de build e runtime

## Compatibilidade gradual

Arquivos JS temporarios permanecem em:

- `backend/config/env.js`
- `backend/config/logger.js`

Eles funcionam como shims e reexportam as implementacoes TypeScript.

Motivo:

- varios modulos do backend ainda estao em JavaScript
- esses modulos continuam importando `../config/env.js` e `../config/logger.js`
- remover os wrappers nesta fase quebraria o runtime antes da conversao completa

## Tipos centrais

Arquivo principal:

- `backend/types/index.ts`

Cobertura:

- runtime env
- auth
- user/profile
- merchant integration
- order e order items
- financial entries e closures
- repository generics
- cache envelope
- request validation payload
- logger context

## Express

Extensoes em:

- `backend/types/express.d.ts`

Adicionado:

- `request.authUser`
- `request.log`
- `request.validated`
- contratos opcionais para `response.success` e `response.fail`

## Build

Script:

- `npm run build:backend`

Configuracao:

- `tsconfig.backend.json`

Pontos principais:

- `allowJs: true` para convivio com modulos legados
- `sourceMap: true`
- `inlineSources: true`
- `outDir: dist-backend`

## Proximo passo recomendado

Migrar na ordem:

1. `middleware/*`
2. `repositories/*`
3. `modules/orders`
4. `modules/sales`
5. `modules/admin`

So depois disso vale remover os shims JS de `config/`.
