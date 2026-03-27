# Code Splitting do Frontend

## Objetivo

Reduzir o custo do carregamento inicial do app React com Vite, mantendo:

- split por rota
- lazy loading para componentes pesados
- vendor chunks mais previsiveis
- analise de bundle reproduzivel com `npm run analyze:bundle`

## O que ficou ativo

### 1. Route-based splitting

As rotas continuam em lazy loading em [src/routes/index.jsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\routes\index.jsx) com `React.lazy()` + `Suspense`.

Cada pagina principal sai em chunk proprio, por exemplo:

- `DashboardPage`
- `OrdersPage`
- `SalesPage`
- `CashPage`
- `FinancialPendingsPage`

### 2. Lazy loading de componentes pesados

Ja existente e mantido:

- `DashboardCharts` em [src/pages/DashboardPage.jsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\pages\DashboardPage.jsx)
- `PosReportsModule` em [src/pages/PosReportsPage.jsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\pages\PosReportsPage.jsx)

### 3. Vendor splitting

Em [vite.config.js](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\vite.config.js) ficaram chunks manuais para:

- `react-vendor`
- `router-vendor`
- `query-vendor`
- `firebase-auth`
- `firebase-data`
- `ui-system`
- `charts-and-reports`
- `operations-workspace`
- `export-utils`

### 4. Module preload mais conservador

Chunks pesados e claramente assincornos deixaram de ser preloaded no HTML inicial:

- `charts-and-reports`
- `operations-workspace`
- `export-utils`
- `firebase-data`

### 5. Monitoring fora do import sincronico

O Sentry saiu do import estatico de [src/services/apiErrorHandler.ts](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\services\apiErrorHandler.ts) e passou para `import('@sentry/react')` sob demanda.

Isso evita pagar esse custo no caminho normal de bootstrap quando nao ha erro para reportar.

## Relatorio before/after

Medicao de referencia antes desta rodada:

| Chunk           | Antes raw | Antes gzip |
| --------------- | --------: | ---------: |
| `index`         |  46.71 kB |   15.12 kB |
| `firebase-auth` | 114.11 kB |   23.20 kB |
| `firebase-data` | 281.76 kB |   63.64 kB |
| `vendor`        | 280.34 kB |   89.33 kB |

Medicao final desta rodada:

| Chunk                  | Depois raw | Depois gzip |
| ---------------------- | ---------: | ----------: |
| `index`                |   33.38 kB |    11.12 kB |
| `react-vendor`         |  142.22 kB |    45.57 kB |
| `router-vendor`        |   13.14 kB |     4.83 kB |
| `query-vendor`         |    2.46 kB |     1.19 kB |
| `ui-system`            |   31.83 kB |    10.37 kB |
| `firebase-auth`        |  114.05 kB |    23.15 kB |
| `firebase-data`        |  281.71 kB |    63.60 kB |
| `vendor`               |  654.33 kB |   212.04 kB |
| `charts-and-reports`   |   44.11 kB |    13.12 kB |
| `operations-workspace` |  157.99 kB |    40.23 kB |

## Leitura correta dos numeros

- O `entry chunk` principal caiu de `15.12 kB gzip` para `11.12 kB gzip`.
- O runtime principal agora fica mais legivel, com React, Router, Query e UI base em chunks separados.
- Os blocos claramente pesados de relatorios e operacao saem do preload inicial.
- O `vendor` residual ainda segue grande em bytes minificados. Ele nao impede a estrategia atual, mas continua sendo o principal candidato para uma proxima rodada de split por dominio.

## Estado atual vs meta

Meta solicitada:

- bundle inicial abaixo de `500 kB gzip`
- carregamento inicial mais leve em 4G

Com a configuracao final, o custo de bootstrap compartilhado mais provavel fica aproximadamente em:

- `index`: `11.12 kB gzip`
- `react-vendor`: `45.57 kB gzip`
- `router-vendor`: `4.83 kB gzip`
- `query-vendor`: `1.19 kB gzip`
- `ui-system`: `10.37 kB gzip`
- `vendor`: `212.04 kB gzip`

Total aproximado do shell compartilhado: `285.12 kB gzip`

Isso fica abaixo do alvo de `500 kB gzip`.

## Limites conhecidos

- Ainda existe aviso de chunk acima de `500 kB` em bytes minificados por causa do `vendor` residual.
- Nao ha rich editor no app hoje, entao nao houve split especifico para esse caso.
- O maior proximo ganho vem de quebrar o `vendor` residual por dominio funcional, por exemplo:
  - observability
  - utilitarios de parsing
  - libs de import/export
  - libs de cliente externo nao usadas no shell inicial

## Como analisar

```bash
npm run analyze:bundle
```

O relatorio HTML sai em:

- [output/bundle-report.html](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\output\bundle-report.html)

## Proxima rodada recomendada

1. Isolar o `vendor` residual por familias de dependencia.
2. Mover dependencias raras do shell para `import()` local.
3. Revisar se alguns modulos do Firebase ainda podem sair do caminho inicial.
