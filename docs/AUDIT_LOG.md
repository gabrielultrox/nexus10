# Audit Log

## Escopo

O sistema registra operacoes criticas em dois fluxos:

- backend: `POST`, `PUT`, `PATCH` e `DELETE` em `/api` passam pelo middleware central
- frontend: operacoes locais que ainda escrevem direto no Firestore continuam usando `src/services/auditService.js`

## Campos persistidos

- `action`
- `module`
- `entityType`
- `entityId`
- `actor`
- `userId`
- `description`
- `reason`
- `before`
- `after`
- `ip`
- `requestId`
- `method`
- `path`
- `statusCode`
- `timestampUtc`
- `timestampLocal`
- `timezone`

## Colecao

Os registros ficam em:

`stores/{storeId}/audit_logs/{auditId}`

## Consultas admin

Endpoint:

`GET /api/admin/audit-logs`

Filtros suportados:

- `page`
- `limit`
- `date`
- `user`
- `action`
- `module`
- `entity`
- `search`

## Exportacoes

Na tela de auditoria:

- CSV
- Excel (`.xls` simples)
- PDF via janela de impressao

## Alertas admin

O backend dispara alerta SSE para admins em casos criticos como:

- exclusao de venda
- alteracoes criticas marcadas com `notifyAdmin`

## Indices Firestore

Aplicar:

```bash
npm run firebase:deploy:indexes
```

O arquivo [firestore.indexes.json](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\firestore.indexes.json) foi atualizado para `audit_logs`.
