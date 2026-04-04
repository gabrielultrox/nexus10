# Runbook: Falha Webhook iFood

## Sintoma

- Pedidos/eventos do iFood deixam de entrar.
- A taxa de falha do webhook sobe no dashboard/alerta.
- Logs mostram erro em `/webhooks/ifood/:storeId/:merchantId`.

## Como diagnosticar

1. Validar se o backend responde:

```bash
curl http://127.0.0.1:8787/api/health
```

2. Verificar logs do backend e eventos recentes:

```bash
npm run logs:tail
```

3. Revisar configuracoes obrigatorias:

- `IFOOD_WEBHOOK_SECRET`
- `IFOOD_AUTH_BASE_URL`
- `IFOOD_MERCHANT_BASE_URL`
- `IFOOD_EVENTS_POLLING_PATH`
- `IFOOD_EVENTS_ACK_PATH`
- `IFOOD_ORDER_DETAILS_PATH`

4. Confirmar se houve regressao no backend:

```bash
npm run test:backend
npm run type-check:backend
```

5. Se o problema tiver surgido apos deploy, validar o endpoint publicado configurado no merchant iFood.

## Ação imediata

- Se o webhook estiver retornando erro 5xx, restaurar o backend para um deploy saudavel.
- Se o erro for assinatura invalida, corrigir `IFOOD_WEBHOOK_SECRET` no ambiente alvo.
- Se o webhook estiver ok, mas o fluxo de eventos falhar, verificar o polling/ack das integracoes iFood.
- Se o problema for de merchant especifico, limitar o impacto a esse merchant e evitar mudancas globais.

## Rollback / mitigação

- Fazer rollback do deploy mais recente se a falha comecou imediatamente apos publicacao.
- Restaurar a configuracao anterior do webhook no painel/merchant iFood.
- Usar replay manual de eventos apenas se existir trilha auditavel e a duplicidade estiver controlada.

## Quando escalar

- Escalar se a taxa de falha do webhook permanecer acima do threshold operacional.
- Escalar se mais de uma loja/merchant parar simultaneamente.
- Escalar se houver perda de pedidos confirmada.
