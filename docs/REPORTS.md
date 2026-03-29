# Relatorios

## Escopo

O endpoint de relatorios centraliza exportacoes PDF e Excel para:

- vendas
- caixa
- entregas
- historico operacional
- auditoria

## Fluxo

1. O frontend envia `POST /api/reports/generate`.
2. O backend grava um registro em `stores/{storeId}/reports`.
3. A geracao roda em background.
4. O arquivo final vai para Firebase Storage em `reports/{storeId}/{reportId}/`.
5. O frontend consulta `GET /api/reports/history` e baixa por `GET /api/reports/:reportId/download`.

## Campos principais

- `type`: `sales | cash | deliveries | operations | audit`
- `format`: `pdf | excel`
- `startDate`, `endDate`
- `operator`
- `module`
- `template`
- `scheduledFor`

## Operacao

- limite operacional atual: `1MB` por arquivo
- retencao registrada no metadata: `30 dias`
- relatórios pesados entram em fila assíncrona

## Validacao local

```bash
npm run type-check:backend
npm run type-check
npm run test:backend
```
