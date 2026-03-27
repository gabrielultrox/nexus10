# Testes no Nexus10

## Setup inicial

1. Instale as dependencias:
   - `npm install`
2. Rode a suite uma vez:
   - `npm run test`
3. Rode cobertura de backend:
   - `npm run test:coverage`
4. Abra a interface do Vitest quando precisar depurar:
   - `npm run test:ui`

## Scripts

- `npm run test`
  - executa a suite uma vez
- `npm run test:watch`
  - modo watch
- `npm run test:coverage`
  - gera cobertura com provider `v8`
- `npm run test:ui`
  - abre a UI do Vitest

## Padrao atual

- testes de frontend ficam em `src/**/*.{test,spec}.*`
- testes de backend podem ficar em:
  - `backend/**/*.{test,spec}.*`
  - `backend/__tests__/`
- cobertura atual esta focada em `backend/**/*.{js,ts}`

## Boas praticas

- prefira testar o contrato publico da rota/modulo
- use mocks de dependencia, nao de logica interna
- cubra sucesso, validacao e falha de integracao
- para adapters HTTP, mocke `fetch` e valide:
  - URL
  - metodo
  - headers
  - body
  - tratamento de erro

## Meta de cobertura

- objetivo dos proximos sprints: `70%+` no backend
- comando de referencia:
  - `npm run test:coverage`
