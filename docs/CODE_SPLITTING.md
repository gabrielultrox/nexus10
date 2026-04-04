# Code Splitting do Frontend

## Objetivo

Reduzir custo do shell inicial do Nexus10 e empurrar dependencias raras para carregamento sob demanda.

Escopo desta rodada:

- quebrar o `vendor` residual por dominio
- tirar Sentry do caminho sincronico do bootstrap
- adiar `html-to-image` ate a acao de exportacao
- medir o resultado com `npm run analyze:bundle`

## O que mudou

### 1. Split adicional por dominio

Em [vite.config.js](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\vite.config.js) os chunks manuais agora separam:

- `query-vendor`: `@tanstack/react-query` + `@tanstack/query-core`
- `router-vendor`: `react-router-dom` + `react-router` + `@remix-run/router`
- `validation-vendor`: `zod`
- `sentry-vendor`: `@sentry/*` + `@sentry-internal/*`

### 2. Sentry fora do bootstrap sincronico

O SDK do frontend em [src/config/sentry.ts](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\config\sentry.ts) saiu de `import * as Sentry from '@sentry/react'` e passou a usar `import('@sentry/react')` com cache interno.

Impacto:

- o shell inicial nao faz preload do chunk de observabilidade
- tags de `user_id` e `store_id` continuam sendo aplicadas depois da inicializacao
- erros continuam capturados, mas a inicializacao ficou lazy

### 3. Exportacao de imagem sob demanda

Os modulos abaixo nao importam mais `html-to-image` no topo:

- [src/modules/cash/components/CashModule.jsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\modules\cash\components\CashModule.jsx)
- [src/modules/operations/components/NativeModuleWorkspace.jsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\modules\operations\components\NativeModuleWorkspace.jsx)

Agora `html-to-image` so e carregado na hora do clique em exportacao.

## Medicao before/after

Baseline desta rodada, antes dos ajustes:

| Chunk           | Antes raw | Antes gzip |
| --------------- | --------: | ---------: |
| `index`         |  32.64 kB |   10.82 kB |
| `react-vendor`  | 142.27 kB |   45.61 kB |
| `firebase-auth` | 114.11 kB |   23.19 kB |
| `firebase-data` | 281.77 kB |   63.64 kB |
| `vendor`        | 467.44 kB |  149.19 kB |

Depois desta rodada:

| Chunk               | Depois raw | Depois gzip |
| ------------------- | ---------: | ----------: |
| `index`             |   31.62 kB |    10.36 kB |
| `react-vendor`      |  142.27 kB |    45.61 kB |
| `router-vendor`     |   22.28 kB |     8.30 kB |
| `query-vendor`      |   41.21 kB |    12.28 kB |
| `validation-vendor` |   65.17 kB |    17.69 kB |
| `ui-system`         |   42.23 kB |    13.71 kB |
| `firebase-auth`     |  114.10 kB |    23.18 kB |
| `vendor`            |   90.21 kB |    30.07 kB |
| `sentry-vendor`     |  458.55 kB |   151.41 kB |
| `export-utils`      |   13.80 kB |     5.45 kB |

## Leitura correta dos numeros

- O `vendor` residual caiu de `149.19 kB gzip` para `30.07 kB gzip`.
- O chunk principal `index` caiu levemente de `10.82 kB gzip` para `10.36 kB gzip`.
- O ganho real veio de tirar dependencias de observabilidade e utilitarios raros do shell inicial.
- O `sentry-vendor` agora e maior que o `vendor` antigo, mas ficou assincorno e nao aparece no preload do HTML inicial.

## Shell inicial real

No `index.html` final, os preloads do shell ficam em:

- `index`
- `react-vendor`
- `router-vendor`
- `query-vendor`
- `validation-vendor`
- `ui-system`
- `vendor`
- `firebase-auth`

O chunk `sentry-vendor` nao e preloaded.

Estimativa de shell compartilhado nesta rodada:

- `index`: `10.36 kB gzip`
- `react-vendor`: `45.61 kB gzip`
- `router-vendor`: `8.30 kB gzip`
- `query-vendor`: `12.28 kB gzip`
- `validation-vendor`: `17.69 kB gzip`
- `ui-system`: `13.71 kB gzip`
- `vendor`: `30.07 kB gzip`
- `firebase-auth`: `23.18 kB gzip`

Total aproximado do shell JS compartilhado: `161.20 kB gzip`

## Tradeoffs

### Mantidos de forma deliberada

- `zod` continua no caminho inicial via [src/config/env.ts](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\config\env.ts), porque o app ainda precisa falhar rapido quando o ambiente esta invalido.
- `firebase-auth` continua no shell, porque o bootstrap de autenticacao depende disso.

### Custos novos

- O primeiro erro capturado ou a primeira inicializacao de observabilidade agora paga o download de `sentry-vendor`.
- A primeira exportacao de imagem agora paga o download de `export-utils`.

Esses custos sao aceitaveis porque sairam do caminho de navegacao normal.

## Proximos candidatos

1. Revisar o que ainda sobra em `vendor-B-exkgfV.js`.
2. Validar se parte de `firebase-auth` pode ser carregada depois do gate de login.
3. Atacar CSS global, que ainda pesa `45.73 kB gzip`.
4. Medir se ha listas que ainda causam custo perceptivel no `DashboardPage` e nos modulos operacionais.

## Como medir

```bash
npm run analyze:bundle
```

Relatorio HTML:

- [output/bundle-report.html](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\output\bundle-report.html)
