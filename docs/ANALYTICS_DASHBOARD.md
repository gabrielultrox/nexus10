# Dashboard Analitico

## Objetivo

- adicionar leitura executiva de negocio ao dashboard operacional
- destacar meta, margem, cancelamentos, entregadores e comportamento de clientes
- manter a resposta rapida com cache Redis de 1 hora

## KPIs escolhidos

- `Vendas vs meta`: compara o faturamento atual com o baseline do periodo anterior acrescido de 5%
- `Margem de lucro`: usa receita menos custo estimado por item
- `Entregador lider`: mede pedidos por hora e taxa de atraso
- `Taxa de cancelamento`: acompanha impacto operacional e financeiro
- `Clientes novos`: separa novos de recorrentes no periodo

## Graficos

- linha: vendas ao longo do tempo
- pizza: mix por categoria
- barras: performance de entregadores
- heatmap: vendas por dia da semana e hora
- barras: motivos de cancelamento

## Backend

- endpoint: `GET /api/dashboard/analytics`
- permissao: `reports:read`
- cache: Redis TTL `3600s`
- recorte maximo: `1 ano`

## Filtros

- loja
- periodo
- modulo: `all`, `pdv`, `ifood`, `ze_delivery`
- comparativo: `periodo anterior`, `semana`, `mes`, `ano`

## Racional de performance

- calculo feito no backend para evitar recomputar no cliente
- cache por chave de filtro
- frontend carrega a secao analitica em lazy chunk separado
- volume sintetico de `50k+` registros coberto no teste de builder
