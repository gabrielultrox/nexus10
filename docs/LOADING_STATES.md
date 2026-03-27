# Loading States

## Objetivo

Nenhuma tela deve aparecer vazia enquanto dados, rotas ou acoes assincronas estao em andamento.

## Componentes base

### Skeleton

Arquivo:

- [src/components/ui/Skeleton.tsx](C:/Users/User/Downloads/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/src/components/ui/Skeleton.tsx)

Uso:

- `variant="line"` para texto e tabelas
- `variant="rect"` para cards e graficos
- `variant="circle"` para avatar ou indicador circular

### LoadingSpinner

Arquivo:

- [src/components/ui/LoadingSpinner.tsx](C:/Users/User/Downloads/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/src/components/ui/LoadingSpinner.tsx)

Uso:

- dentro de botao em mutacao
- overlays
- estados inline pequenos

### LoadingOverlay

Arquivo:

- [src/components/ui/LoadingOverlay.tsx](C:/Users/User/Downloads/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/src/components/ui/LoadingOverlay.tsx)

Uso:

- modulos inteiros
- cards grandes
- shell da pagina em sincronizacao

## Padroes por contexto

### Tabela

- usar `Table` com `isLoading`
- o componente gera linhas de `Skeleton` automaticamente

### Card

- usar `Skeleton` com `variant="rect"` e blocos menores para texto

### Pagina

- usar `LoadingOverlay` com `backdrop`
- manter o layout base visivel para evitar CLS

### Botao

- usar `loading` e `loadingLabel`
- o botao fica desabilitado e recebe spinner interno

## Integracao com queries

Hooks atuais:

- [src/hooks/queries/useOrders.ts](C:/Users/User/Downloads/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/src/hooks/queries/useOrders.ts)
- [src/hooks/queries/useSales.ts](C:/Users/User/Downloads/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/src/hooks/queries/useSales.ts)
- [src/hooks/queries/useFinancialEntries.ts](C:/Users/User/Downloads/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/src/hooks/queries/useFinancialEntries.ts)
- [src/hooks/queries/useFinancialClosures.ts](C:/Users/User/Downloads/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/src/hooks/queries/useFinancialClosures.ts)
- [src/hooks/queries/useDashboardOrders.ts](C:/Users/User/Downloads/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/src/hooks/queries/useDashboardOrders.ts)
- [src/hooks/queries/useDashboardSales.ts](C:/Users/User/Downloads/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/src/hooks/queries/useDashboardSales.ts)

Padrao:

1. Ler `isLoading`
2. Renderizar `Skeleton` ou `LoadingOverlay`
3. Ler `error`
4. Renderizar estado de erro claro
5. Renderizar conteudo real quando `data` estiver pronta

## Paginas integradas

- [src/pages/OrdersPage.jsx](C:/Users/User/Downloads/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/src/pages/OrdersPage.jsx)
- [src/pages/SalesPage.jsx](C:/Users/User/Downloads/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/src/pages/SalesPage.jsx)
- [src/pages/DashboardPage.jsx](C:/Users/User/Downloads/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/src/pages/DashboardPage.jsx)
