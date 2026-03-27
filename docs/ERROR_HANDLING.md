# Error Handling

## Objetivo

Padronizar captura, exibicao e recuperacao de erros no frontend do Nexus10 sem deixar a interface em estado morto.

## Componentes

### `ErrorBoundary`

Arquivo:

- [src/components/system/ErrorBoundary.tsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\components\system\ErrorBoundary.tsx)

Responsabilidades:

- interceptar falhas de renderizacao
- enviar erro para monitoramento
- exibir fallback amigavel
- oferecer recuperacao local e recarga completa

Uso:

```tsx
<ErrorBoundary resetKey={location.pathname} onReset={() => navigate('/dashboard')}>
  <AppRoutes />
</ErrorBoundary>
```

### `ErrorDisplay`

Arquivo:

- [src/components/ui/ErrorDisplay.tsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\components\ui\ErrorDisplay.tsx)

Responsabilidades:

- mostrar mensagem padronizada
- exibir codigo de erro funcional (`ERR_001`, `ERR_010`, etc.)
- orientar a proxima acao
- opcionalmente renderizar botoes de recovery

## Hook `useError`

Arquivo:

- [src/hooks/useError.ts](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\hooks\useError.ts)

Responsabilidades:

- normalizar erro com contexto
- enviar para monitoramento
- disparar toast padrao
- repetir operacoes recuperaveis com backoff

Exemplo:

```tsx
const { captureError, runWithErrorHandling, errorModel } = useError({
  context: { feature: 'auth', action: 'login' },
})
```

## Camada central de erro de API

Arquivo:

- [src/services/apiErrorHandler.ts](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\services\apiErrorHandler.ts)

O que ela faz:

- transforma resposta do backend em `AppError`
- converte erro tecnico em mensagem amigavel
- integra monitoramento com Sentry
- define quais erros podem ser repetidos
- aplica retry com backoff exponencial
- enfileira mutacoes quando o app estiver offline

## Request pipeline

Arquivo:

- [src/services/backendApi.js](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\services\backendApi.js)

Fluxo:

1. resolve autenticacao
2. aplica timeout
3. repete `GET` e erros recuperaveis
4. normaliza resposta de erro
5. fila offline para mutacoes
6. reenvia automaticamente ao reconectar

## Estados offline

Implementado em:

- [src/App.jsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\App.jsx)

Comportamento:

- banner fixo no topo quando `navigator.onLine === false`
- contagem de requisicoes pendentes
- flush automatico ao evento `online`
- toast de confirmacao apos reenvio

## Erros inline de formulario

Exemplo real:

- [src/pages/LoginPage.jsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\pages\LoginPage.jsx)

Padrao:

- `aria-invalid`
- `aria-describedby`
- mensagem abaixo do campo
- borda vermelha no campo com erro

## Exemplos integrados

Paginas com uso real:

- [src/pages/LoginPage.jsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\pages\LoginPage.jsx)
- [src/pages/OrdersPage.jsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\pages\OrdersPage.jsx)
- [src/pages/SalesPage.jsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\pages\SalesPage.jsx)
- [src/pages/DashboardPage.jsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\pages\DashboardPage.jsx)

## Regras praticas

- toda falha de render deve passar pelo `ErrorBoundary`
- toda falha de request deve passar por `requestBackend`
- toda tela com fetch deve renderizar `loading`, `error` e `success`
- nao usar `console.error` para fluxo normal de app
- nao devolver mensagem tecnica bruta do backend para o usuario
- em mutacao offline, preferir enfileirar antes de perder a acao
