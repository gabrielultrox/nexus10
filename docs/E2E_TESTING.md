# Testes E2E com Playwright

## Objetivo

Cobrir os fluxos que mais geram regressao visual e operacional no frontend:

1. Login
2. Criacao de pedido
3. Criacao de venda
4. Fluxo de caixa
5. Dashboard de integracao Ze Delivery

## Estrutura

- `playwright.config.ts`: configuracao principal
- `e2e/fixtures/app.ts`: bootstrap do ambiente E2E, sessao e estado inicial
- `e2e/helpers/commerce.ts`: helpers reutilizaveis dos fluxos comerciais
- `e2e/*.spec.ts`: specs por fluxo

## Como roda localmente

Instale os browsers uma vez:

```bash
npx playwright install chromium
```

Execute toda a suite:

```bash
npm run test:e2e
```

Modo visual:

```bash
npm run test:e2e:headed
```

Modo UI do Playwright:

```bash
npm run test:e2e:ui
```

## Como funciona o ambiente de teste

Os specs usam um runtime E2E controlado por `localStorage`:

- `nexus10.e2e.enabled=true`
- `nexus10.e2e.state=<json>`

Esse runtime injeta:

- sessao local autenticada quando necessario
- loja padrao `hora-dez`
- clientes e produtos de catalogo
- estado inicial do dashboard Ze Delivery
- falhas simuladas para cenarios criticos

## Comandos no CI

Suite completa:

```bash
npx playwright test
```

Gerar relatorio HTML:

```bash
npx playwright show-report
```

## Cenarios cobertos

### Login

- PIN correto + senha correta
- senha incorreta

### Pedidos

- cria pedido com sucesso
- falha controlada ao salvar pedido

### Vendas

- cria venda direta com sucesso
- falha controlada ao lancar venda

### Caixa

- abertura
- fechamento

### Ze Delivery

- dashboard carrega
- sincronizacao manual com sucesso
- erro controlado de sincronizacao

## Como simular falhas

Os helpers usam o campo `failures` no estado E2E.

Exemplos:

- `createOrder: 1`
- `createSale: 1`
- `zeDeliverySync: 1`

Cada valor representa quantas chamadas consecutivas devem falhar antes de voltar ao comportamento normal.

## Gaps pendentes

Esta suite valida o fluxo do frontend com estado deterministico. Ela nao substitui:

- integracao real com Firebase/Auth/Firestore
- integracao real com backend Express
- scraper real do Ze Delivery
- validacao ponta a ponta em ambiente com dados reais

Para esses casos, o complemento correto e manter:

- testes backend/Vitest
- smoke tests com ambiente integrado
- testes manuais ou E2E dedicados para staging
