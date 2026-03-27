# TanStack Query usage in Nexus10

## Provider

The provider is mounted in:

- [src/App.jsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\App.jsx)

The shared client lives in:

- [src/services/queryClient.ts](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\services\queryClient.ts)

Defaults:

- retry automatico para erros recuperaveis
- `staleTime`: 30s
- `gcTime`: 5 min
- sem `refetchOnWindowFocus`
- logging centralizado em `QueryCache` e `MutationCache`

## Hooks disponíveis

- [src/hooks/queries/useOrders.jsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\hooks\queries\useOrders.jsx)
- [src/hooks/queries/useSales.jsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\hooks\queries\useSales.jsx)
- [src/hooks/queries/useFinancialClosures.jsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\hooks\queries\useFinancialClosures.jsx)
- chaves centralizadas em [src/hooks/queries/queryKeys.js](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\hooks\queries\queryKeys.js)

## Exemplo de leitura

```jsx
const { data, isLoading, isFetching } = useOrders({
  storeId,
  pageSize: 50,
  cursor,
})

const items = data?.items ?? []
const nextCursor = data?.nextCursor ?? null
```

## Exemplo de mutation

```jsx
const { createOrderMutation } = useOrderMutations({
  storeId,
  tenantId,
  createdBy: currentUser,
})

await createOrderMutation.mutateAsync(values)
```

## Padrão adotado

1. Query hooks chamam a camada de serviço existente.
2. Mutations invalidam `queryKeys` do recurso.
3. Erros de query passam por:
   - log central no `QueryClient`
   - toast via `useQueryErrorFeedback`
4. Erros de mutation passam por `useErrorHandler`.

## Quando usar

Use React Query para:

- listas paginadas
- detalhes por id
- mutations com invalidação de cache
- dados HTTP/async que não precisam de `onSnapshot` permanente

Não use React Query como substituto direto para todos os fluxos realtime já baseados em `onSnapshot` sem antes decidir a estratégia de sincronização.
