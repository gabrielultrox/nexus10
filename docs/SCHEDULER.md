# Scheduler Zé Delivery

## Objetivo

Executar a sincronização do Zé Delivery com tolerância a falhas, múltiplas instâncias e visibilidade operacional.

## Componentes

- `scripts/scheduler.js`
  - agenda com `node-cron`
  - faz shard das lojas entre workers PM2
  - controla graceful shutdown
  - escreve arquivos de health em `tmp/ze-delivery-scheduler-state-*.json`
- `ecosystem.config.js`
  - define o processo `nexus10-ze-delivery-sync`
  - 2 instâncias
  - restart automático
  - logs PM2 dedicados
- `GET /api/integrations/ze-delivery/health`
  - snapshot operacional resumido
- `GET /api/integrations/ze-delivery/dashboard`
  - resumo, erros recentes, status por loja e workers

## Execução local

Node direto:

```bash
npm run scheduler:start
```

PM2:

```bash
npm run scheduler:pm2:start
npm run scheduler:pm2:restart
npm run scheduler:pm2:stop
```

Shell scripts:

```bash
./scripts/start-scheduler.sh
./scripts/restart-scheduler.sh
./scripts/stop-scheduler.sh
```

## PM2

Configuração aplicada:

- nome: `nexus10-ze-delivery-sync`
- instâncias: `2`
- memória máxima: `500MB`
- `watch: true`
- `cron_restart: */5 * * * *`
- `max_restarts: 5`
- `min_uptime: 60s`

Observação:

- o ciclo real de sincronização continua dentro do `node-cron` do scheduler
- o `cron_restart` do PM2 foi deixado explícito para reciclagem frequente, como solicitado
- se isso gerar reinício excessivo em produção, ajuste a janela de `cron_restart`

## Múltiplas lojas

Variáveis relevantes:

- `ZE_DELIVERY_STORE_IDS=store-01,store-02,store-03`
- `ZE_DELIVERY_WORKER_COUNT=2`

Estratégia:

- cada worker recebe um subconjunto das lojas por índice módulo `workerCount`
- isso evita que dois workers raspem a mesma loja ao mesmo tempo

## Logs

Scheduler:

- `logs/ze-delivery-sync-YYYY-MM-DD.log`

PM2:

- `logs/pm2-ze-delivery-out.log`
- `logs/pm2-ze-delivery-error.log`

Todos os logs do scheduler saem em JSON estruturado.

## Health

Endpoint:

```http
GET /api/integrations/ze-delivery/health
```

Campos principais:

- `status`
- `lastSync`
- `nextSync`
- `errorCount`
- `successRate`

## Dashboard

Endpoint:

```http
GET /api/integrations/ze-delivery/dashboard
```

Retorna:

- resumo operacional
- estado dos workers
- erros recentes
- status e logs por loja

## Docker

Subir tudo:

```bash
docker-compose --env-file .env.docker.example up --build
```

Serviços:

- `backend`
- `ze-delivery-scheduler`
- `redis`
- `firestore-emulator`

O scheduler sobe com:

```bash
pm2-runtime start ecosystem.config.js --only nexus10-ze-delivery-sync
```

## Troubleshooting

### Sem lojas atribuídas

- valide `ZE_DELIVERY_STORE_IDS`
- valide `ZE_DELIVERY_WORKER_COUNT`

### Scheduler fica em `degraded`

- consulte `GET /api/integrations/ze-delivery/dashboard`
- veja `recentErrors`
- confira `logs/ze-delivery-sync-*.log`

### Falha de login/scrape

- rode `npm run ze-delivery:test -- --storeId=<id>`
- ajuste seletores `ZE_DELIVERY_*_SELECTOR`
