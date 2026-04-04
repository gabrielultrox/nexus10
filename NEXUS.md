# NEXUS.md

## Produto

NEXUS-10 é um ERP operacional para a Whiskeria Hora Dez, uma conveniência
em Divinópolis, MG, Brasil. Foco em operação de turno, entregas, PDV,
pedidos, vendas, caixa e gestão financeira diária.
Linguagem de toda a UI: português brasileiro.

## Stack

Frontend:

- React 18 + Vite 5
- React Router 6
- Tailwind CSS
- Firebase / Firestore (com fallback local)

Backend:

- Express 4
- Firebase Admin

Infraestrutura:

- Node.js 18+
- Deploy: Vercel (frontend)
- Backend: deploy separado
- Auth: PIN local + perfis por papel

## Scripts

npm run dev # frontend Vite
npm run dev:backend # backend Express com watch
npm run dev:full # frontend + backend juntos
npm run build # build de produção
npm run preview # preview do build
npm run start:backend # backend sem watch

## Estrutura de Pastas

src/ # frontend React
components/
ui/ # design system global (criar aqui)
caixa/ # componentes do módulo Caixa
pdv/ # componentes do módulo PDV
pages/ # uma pasta por módulo/rota
hooks/ # hooks globais (useToast, useCaixa, etc)
lib/ # utilitários, firebase, helpers

backend/ # servidor Express + iFood
routes/
services/

api/ # camada de API separada do backend Express # verificar antes de criar rotas em backend/

public/ # assets estáticos
docs/ # documentação auxiliar (já existe)
prompts/ # prompts de refatoração por tema (criar aqui)
decisions/ # decisões de design e arquitetura (criar aqui)
scripts/ # scripts utilitários
skills/ # skills de agentes de IA (não modificar)
legacy/ # HTML monolítico original (não modificar nunca)

## Módulos

Operação:

- Entregadores, Escala, Leitura, Maquininhas
- Vales, Descontos, Trocos, Mapa, Ocorrências

Comercial:

- Pedidos, Vendas, PDV Central
- Produtos, Estoque, Clientes

Financeiro:

- Caixa: Abertura, Sangria, Suprimento, Retirada, Fechamento

Histórico:

- Calendário por dia, timeline operacional, filtro por módulo

Sistema:

- Audit log, Configurações, Análise

## Design System

Linguagem visual: industrial-tech, dark mode, minimalista, funcional.
Sem glassmorphism, sem gradientes decorativos, sem sombras pesadas.

Tokens CSS:
--bg-base: #0F1117
--bg-surface: #1A1D27
--bg-elevated: #222636
--border: #2D3248
--text-primary: #F1F3F9
--text-secondary: #8B92A5
--text-muted: #4B5268
--accent: #6B8AFF
--accent-soft: rgba(107,138,255,0.12)
--success: #22C55E
--warning: #F59E0B
--danger: #EF4444

Tipografia: Inter.

- Label uppercase: 10px, tracking-wider, --text-muted
- Corpo: 13px, --text-secondary
- Valor de métrica: 28px bold, --text-primary
- Título de página: 18px semibold, --text-primary

Medidas padrão:

- Border-radius: 12px cards, 8px inputs/botões, 6px badges
- Row height: 44px
- Input height: 36px
- Topbar height: 48px
- Sidebar width: 200px

## Componentes Globais (src/components/ui/)

Estes componentes precisam existir antes de qualquer refatoração de tela.
Se não existirem, criar antes de continuar.

Select.jsx

- Nunca usar <select> nativo do browser
- appearance: none, chevron SVG customizado
- Estilo: bg --bg-elevated, border 1px --border, height 36px, radius 8px

MetricCard.jsx

- Props: label, value, delta, description, variant
- Variantes: neutral | warning | danger | success | info
- Cada variante aplica background soft automático (6% opacidade)

FormRow.jsx

- Linha de formulário padrão para todos os módulos
- display flex, gap 8px, height 36px, sem card aninhado

Toast.jsx + useToast.js

- Posição: bottom-right, z-index 9999
- Variantes: success | error | warning | info
- Duração: 3s automático
- Animação: translateY(8px)→0, opacity 0→1, 200ms

StatusBadge.jsx

- Mapeamento automático por string de status
- "pendente", "aberto", "fila" → warning
- "lançada", "ok", "confirmado" → success
- "atrasado", "alerta", "crítico" → danger
- "enviado", "turbo" → info

EmptyState.jsx

- Ícone inline + mensagem, height 64px
- Sem card extra, sem ilustração
- Usar em toda lista ou tabela vazia

## Padrões Obrigatórios

## Regras de Execução

Toda alteração deve seguir esta ordem:

1. Analisar primeiro e identificar a causa raiz
2. Implementar a correção com o menor risco possível
3. Preservar compatibilidade com o restante do sistema
4. Validar com `npm run type-check`, testes e `npm run build`
5. Fazer commit e push automáticos ao final

Restrições permanentes:

- Nunca incluir `.env.local` ou arquivos locais de ambiente em commit
- Não alterar runtime fora do escopo sem necessidade
- Preferir correção pontual antes de refatorar estruturas amplas

Formato padrão de entrega:

- o que foi alterado
- validação executada
- riscos residuais
- próximo passo recomendado

Formulários de alta frequência (Leitura, Trocos, Vales):

- autoFocus no primeiro campo ao montar
- Enter submete, Tab navega entre campos
- Reset automático após registro
- Toast de confirmação sempre

Tabelas:

- Header: 10px uppercase, --text-muted, bg --bg-elevated
- Row: 44px, hover bg --accent-soft
- Ações: opacity 0 por padrão, opacity 1 no hover da row
- Ordenação padrão: mais recente primeiro
- Vazio: EmptyState.jsx

Animações:

- Entrada de rows: translateY(6px)→0, opacity 0→1, 200ms,
  delay escalonado 40ms por row
- Nova row no topo: translateY(-8px)→0, opacity 0→1, 250ms
- Remoção de row: translateX(16px) + opacity→0 + max-height→0, 200ms
- Respeitar prefers-reduced-motion em todas as animações

## O Que Nunca Fazer

- Modificar qualquer arquivo em legacy/
- Modificar qualquer arquivo em skills/
- Usar <select> nativo do browser
- Criar card dentro de card dentro de card (máximo 2 níveis)
- Expor mais de 1 botão primário (--accent) por tela
- Expor mais de 4 botões de ação simultaneamente
- Adicionar texto descritivo longo dentro de MetricCard
- Usar ALL CAPS em nomes de produtos ou clientes
- Usar fonte mono exceto em códigos PED-_ e VEN-_
- Criar tela nova sem seguir o shell: sidebar + topbar + content
- Criar rota nova em backend/ sem verificar se já existe em api/

## Estado Atual (atualizar a cada sprint)

Concluído:

- Migração completa do HTML monolítico para React/Vite
- Shell global: sidebar, topbar, breadcrumb, dark mode
- Dashboard operacional com gráficos (Chart.js)
- Módulos operacionais: Entregadores, Escala, Leitura, Maquininhas
- Módulos financeiros: Vales, Descontos, Trocos
- Comercial: Pedidos, Vendas, PDV Central
- Catálogo: Produtos (~4.000 itens), Estoque, Clientes
- Histórico operacional com calendário e timeline
- Impressão térmica 80x297 com área segura
- Autenticação local com PIN e perfis por papel
- Persistência local com fallback para Firestore
- Deploy estável no Vercel
- Backend Express com integração iFood iniciada

Em andamento:

- Design system global (Select, MetricCard, FormRow, Toast,
  StatusBadge, EmptyState)
- Estado persistente do Caixa com guardrails de fluxo
- Semântica de cor nos MetricCards
- Atalhos de teclado em formulários de alta frequência
- Acesso contextual ao histórico nos módulos
- Topbar unificada do PDV (remover header duplo)
- Ação inline "Lançar venda" na tabela de pedidos

Pendente:

- Agrupamento de entregadores por estado de turno
- Grade visual de turnos na Escala
- Confirmação em massa de maquininhas
- Chips de filtro rápido no Histórico
- Integração iFood completa e ativa
- Módulo Caixa com sub-fluxos e estado persistente

## Prompts de Refatoração

Localização: docs/prompts/

01-design-system-global.md — Select, MetricCard, FormRow, Toast,
StatusBadge, EmptyState
02-caixa-estado-guardrails.md — CaixaStatusBar, sub-fluxos, guardrails
03-leitura-alta-frequencia.md — formulário inline, atalhos, feedback
04-entregadores-escala.md — agrupamento, grade de turnos,
confirmação em massa de maquininhas
05-pdv-topbar-pedidos.md — topbar unificada, ação inline, semântica
06-historico-acesso-contextual.md — chips, filtro por query param,
link contextual nos módulos
07-tabelas-animacoes.md — padrão global de tabela e animações

Antes de iniciar qualquer tarefa de UI, verificar se existe prompt
correspondente em docs/prompts/ e ler antes de escrever código.

## Decisões de Arquitetura

Localização: docs/decisions/

Registrar aqui qualquer decisão técnica relevante no formato:

- Data
- Decisão
- Motivo
- Alternativas descartadas

Exemplos a documentar:

- Por que api/ e backend/ são pastas separadas
- Estratégia de fallback local vs Firestore
- Política de autenticação (PIN local vs Firebase Auth)
- Estrutura de rotas do React Router
