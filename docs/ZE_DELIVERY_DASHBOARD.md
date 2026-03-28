# Ze Delivery Dashboard

## Objetivo

O painel em `/integrations/ze-delivery` centraliza operacao, saude e configuracao da sincronizacao do Ze Delivery por loja.

## O que a tela mostra

- Status operacional:
  - ultima sincronizacao
  - proxima sincronizacao
  - estado do scheduler
  - taxa de sucesso
- Estatisticas das ultimas 24h:
  - entregas sincronizadas
  - erros
  - tempo medio
  - taxa de falha
- Controles:
  - sincronizar agora
  - ativar/desativar
  - alterar intervalo
  - ativar notificacoes
  - definir webhook
- Historico recente:
  - ultimas sincronizacoes
  - busca e filtro
  - exportacao CSV
  - detalhes com stack trace
  - retry

## Rotas de backend usadas

- `GET /api/integrations/ze-delivery/dashboard?storeId=<id>`
- `GET /api/integrations/ze-delivery/settings?storeId=<id>`
- `PATCH /api/integrations/ze-delivery/settings`
- `POST /api/integrations/ze-delivery/sync`

## Persistencia de configuracao

As configuracoes por loja ficam no documento:

`/stores/{storeId}/integrations/ze_delivery`

Campo salvo:

```json
{
  "settings": {
    "enabled": true,
    "intervalMinutes": 10,
    "notificationsEnabled": false,
    "notificationWebhookUrl": ""
  }
}
```

## Comportamento do scheduler

- `enabled=false` faz o worker ignorar a loja no ciclo automatico
- `intervalMinutes` controla o intervalo efetivo por loja
- o worker continua rodando no cron global, mas faz skip quando o intervalo da loja ainda nao venceu

## Auto-refresh

O dashboard usa React Query com:

- `refetchInterval: 30s`
- `staleTime: 15s`

## Estrutura de frontend

- `src/pages/ZeDeliveryIntegrationPage.jsx`
- `src/components/integrations/ZeDeliveryStatus.tsx`
- `src/components/integrations/ZeDeliveryLogs.tsx`
- `src/components/integrations/ZeDeliveryErrorModal.tsx`
- `src/hooks/queries/useZeDeliverySyncStatus.ts`
- `src/hooks/mutations/useTriggerZeDeliverySync.ts`

## Observacoes

- O toggle de ativacao persiste no backend.
- O modal de erro mostra stack trace apenas quando a falha foi persistida pelo scheduler.
- O retry da UI dispara uma nova sincronizacao manual da loja; nao reprocessa um pedido individual.
