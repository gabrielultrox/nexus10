# Backup Sync

## Objetivo

- sincronizar dados locais criticos para Firestore em background
- reduzir risco de perda antes do reenvio normal/offline
- expor estado operacional no painel admin

## Escopos cobertos

- movimentacao de caixa
- estado do caixa
- pendencias financeiras
- historico local de auditoria
- fila offline de requisicoes
- entregadores locais
- modulos operacionais locais

## Arquitetura

- frontend:
  - [src/services/backupService.js](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\services\backupService.js)
  - [src/hooks/useBackupSync.tsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\hooks\useBackupSync.tsx)
- backend:
  - [backend/services/conflictResolver.ts](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\backend\services\conflictResolver.ts)
  - [backend/services/backupMonitor.ts](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\backend\services\backupMonitor.ts)
  - [backend/scripts/backupScheduler.ts](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\backend\scripts\backupScheduler.ts)

## Firestore

- snapshots:
  - `stores/{storeId}/backup_snapshots/{scopeId}`
- logs:
  - `stores/{storeId}/backup_logs/{runId}`
- status:
  - `stores/{storeId}/settings/backup_status`
- auditoria diaria:
  - `ops_reports/backup/daily/{YYYY-MM-DD}`

## Gatilhos

- imediato:
  - alteracoes em caixa
  - pendencias financeiras
  - fila offline
  - modulos operacionais criticos
- batch:
  - historico local e demais escopos nao criticos
  - janela de 5 minutos

## Conflitos

- estrategia: `last-write-wins`
- base: `updatedAtClient`
- quando o remoto e mais novo, o snapshot local nao sobrescreve

## Operacao

- rodar auditoria unica:

```bash
npm run backup:audit
```

- manter scheduler local:

```bash
npm run backup:scheduler:start
```

- PM2:

```bash
npm run backup:scheduler:pm2:start
npm run backup:scheduler:pm2:restart
npm run backup:scheduler:pm2:stop
```

## Painel admin

- JSON:
  - `GET /api/admin/monitoring/summary`
  - campo: `data.backups`
- HTML:
  - `GET /api/admin/monitoring/dashboard`
