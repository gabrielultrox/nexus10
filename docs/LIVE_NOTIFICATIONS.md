# Live Notifications

## Arquitetura

- Backend SSE em `/api/events`
- Event bus central em `backend/services/eventBus.ts`
- Hook de conexao em `src/hooks/useLiveNotifications.tsx`
- Provider central em `src/providers/NotificationProvider.tsx`
- Preferencias em `stores/{storeId}/notifications_preferences/{userId}`

## Eventos cobertos nesta fase

- `order.created`
- `order.status.changed`
- `machine.confirmed`
- `delivery.delayed`
- `cash.critical`
- `integration.alert`

## Preferencias

Cada usuario pode controlar:

- `channels.toast`
- `channels.sound`
- `channels.vibration`
- `channels.badge`
- tipos de evento habilitados por categoria

Fallback local:

- quando Firestore nao estiver disponivel, as preferencias ficam em `localStorage`

## Reconexao

- o hook SSE reconecta automaticamente com backoff exponencial
- estados expostos:
  - `idle`
  - `connecting`
  - `connected`
  - `reconnecting`
  - `disconnected`

## Limite de ruido

- o provider apresenta no maximo 5 notificacoes por minuto por operador
- notificacoes excedentes continuam persistidas no centro operacional, mas sem toast/som adicional

## Validacao manual

### Backend

```bash
curl "http://127.0.0.1:8787/api/events?access_token=SEU_FIREBASE_ID_TOKEN"
```

Em ambiente nao produtivo, publique um evento de teste:

```bash
curl -X POST "http://127.0.0.1:8787/api/events/debug/publish" ^
  -H "Content-Type: application/json" ^
  -d "{\"type\":\"order.created\",\"title\":\"Teste\",\"message\":\"Evento SSE\",\"severity\":\"info\",\"storeId\":\"hora-dez\"}"
```

### Frontend

- abra o centro operacional no header
- confirme badge na sidebar
- confirme estado `Tempo real ativo`
- altere som e vibracao nos toggles do painel

## Teste automatizado

```bash
npm run test:e2e -- e2e/notifications.spec.ts
```
