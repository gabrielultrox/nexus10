# Dashboard Executivo

## Objetivo

O dashboard executivo do nexus10 foi desenhado para leitura rapida da operacao por loja e turno. A tela prioriza sinais acionaveis, nao apenas volume bruto de dados.

## KPIs escolhidos

### Pedidos no recorte

Mostra tamanho da fila atual e pressao operacional imediata.

- Valor: total de pedidos no periodo filtrado
- Meta: pedidos em aberto e atrasados
- Acao: abrir `/orders`

### Vendas faturadas

Mostra resultado comercial consolidado do turno.

- Valor: total vendido no periodo
- Meta: quantidade de vendas e ticket medio
- Acao: abrir `/sales`

### Caixa do turno

Mostra leitura de caixa com status operacional.

- Valor: saldo atual
- Meta: caixa aberto/fechado
- Acao: abrir `/cash`

### Pendencias financeiras

Mostra impacto financeiro que ainda depende de retorno ao cliente ou ajuste interno.

- Valor: montante em aberto
- Meta: quantidade aberta e prioridade alta
- Acao: abrir `/financial-pendings`

### Falhas operacionais

Consolida os principais riscos que travam a operacao.

- Valor: soma de pedidos atrasados, ocorrencias, pendencias criticas e falhas de integracao
- Meta: ocorrencias abertas e checks pendentes
- Acao: abrir a area correspondente a cada alerta

### Entregadores ativos

Mostra capacidade atual de rua.

- Valor: escala ativa do turno
- Meta: leituras fechadas e base cadastrada
- Acao: abrir `/delivery-reading`

## Estrutura da tela

### Hero executivo

Resume loja, turno, status geral, 3 sinais principais e atalhos diretos para areas criticas.

### Cards de comando

Transformam cada frente operacional em um ponto de decisao com valor, contexto e CTA.

### Mesa executiva

Agrupa:

- riscos do turno
- financeiro e caixa
- entregadores e leitura
- top produtos
- estoque e abastecimento

## Fontes de dados

### Remotas

- pedidos
- vendas
- estoque
- lancamentos financeiros

### Locais operacionais

- escala
- ocorrencias
- vales
- checklist de maquininha
- leituras de entrega
- pendencias financeiras
- estado do caixa

## Priorizacao de alertas

Ordem de severidade adotada:

1. pedidos fora da janela
2. pendencias financeiras criticas
3. ocorrencias abertas
4. checklists e estoque

Essa ordem foi escolhida porque ataca primeiro o que afeta cliente, faturamento e continuidade do turno.

## Limitacoes conhecidas

- pendencias financeiras ainda dependem dos registros operacionais locais sincronizados pelo modulo
- o card de integracoes do iFood reflete merchants configurados e pedidos vistos no recorte, nao um health endpoint dedicado
- o sinal do Ze Delivery depende do dashboard de sincronizacao ja existente
- o dashboard nao substitui analise historica profunda; ele foi desenhado para decisao rapida

## Validacao esperada

- leitura principal em menos de 10 segundos para um gerente novo na tela
- principais acoes em no maximo 1 clique
- responsivo em tablet e mobile sem perder CTA
- fallback visual com skeleton e overlay durante carregamento
