# Runbook: Falha Scheduler Zé Delivery

## Sintoma

- Entregas do Zé Delivery nao sincronizam.
- Dashboard mostra scheduler parado, degradado ou com erro.
- Endpoint de health do scheduler indica falhas consecutivas.

## Como diagnosticar

1. Consultar health e dashboard:

```bash
curl http://127.0.0.1:8787/api/integrations/ze-delivery/health
curl http://127.0.0.1:8787/api/integrations/ze-delivery/dashboard
```

2. Verificar logs estruturados:

```bash
npm run logs:list
npm run logs:tail
```

3. Se usar PM2, validar estado do processo:

```bash
pm2 status nexus10-ze-delivery-sync
```

4. Rodar sync manual para confirmar se o problema esta no scheduler ou no scraper:

```bash
npm run ze-delivery:sync
```

5. Se precisar reproduzir com browser visivel:

```bash
npm run ze-delivery:test -- --storeId=loja-01
```

## Ação imediata

- Se o processo caiu, reiniciar o scheduler:

```bash
npm run scheduler:pm2:restart
```

- Se PM2 nao estiver ativo, subir o scheduler direto:

```bash
npm run scheduler:start
```

- Se o erro for de sessao/login do Zé Delivery, renovar a sessao com `ZE_DELIVERY_HEADLESS=false` e salvar novo `ZE_DELIVERY_SESSION_FILE`.
- Se for erro em apenas uma loja, limitar o diagnostico ao `storeId` afetado antes de reiniciar todos os workers.

## Rollback / mitigação

- Pausar temporariamente a integracao por loja se ela estiver causando ruido operacional.
- Operar sincronizacao manual com `npm run ze-delivery:sync` enquanto a causa raiz nao foi corrigida.
- Restaurar o ultimo conjunto valido de seletores/credenciais do Zé Delivery no `.env`.

## Quando escalar

- Escalar se o scheduler continuar em `degraded` apos restart.
- Escalar se houver falhas consecutivas por mais de 30 minutos.
- Escalar se o scraping falhar por mudanca de layout do Zé Delivery e exigir novos seletores.
