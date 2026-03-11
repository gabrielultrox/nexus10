import { loadAuditEvents } from './localAudit';

const moduleContentByPath = {
  schedule: {
    metrics: [
      { label: 'Entregadores escalados', value: '03', meta: 'Escala manual do dia em andamento', badgeText: 'online', badgeClass: 'ui-badge--success' },
      { label: 'Janelas confirmadas', value: '92%', meta: '2 janelas ainda precisam de reforco', badgeText: 'alerta', badgeClass: 'ui-badge--warning' },
      { label: 'Ajustes pendentes', value: '04', meta: 'Revisar a escala antes de 19:30', badgeText: 'fila', badgeClass: 'ui-badge--info' },
    ],
    panels: [
      {
        title: 'Janelas do turno',
        items: [
          { label: '18:00 - 20:00', value: '6 entregadores', tone: 'success' },
          { label: '20:00 - 22:00', value: '8 entregadores', tone: 'info' },
          { label: '22:00 - 00:00', value: '4 entregadores', tone: 'warning' },
        ],
      },
      {
        title: 'Ajustes recentes',
        timeline: [
          { title: 'Reforco noturno confirmado', meta: '2 entregadores adicionados ao turno ha 8 min' },
          { title: 'Escala do jantar revisada', meta: 'Janela principal ganhou uma rota de apoio extra' },
          { title: 'Fila de pausa redistribuida', meta: 'Despacho manteve 100% das janelas de entrega abertas' },
        ],
      },
    ],
    table: {
      title: 'Escala do dia',
      columns: ['Entregador', 'Janela', 'Maquininha', 'Status'],
      rows: [
        ['Moizes', '18:00 - 22:00', 'Maq. 03', 'Confirmado'],
        ['Tito', '19:00 - 23:00', 'Maq. 05', 'Em rota'],
        ['Bianca Freitas', '20:00 - 00:00', 'Maq. 11', 'Reserva'],
      ],
    },
  },
  advances: {
    metrics: [
      { label: 'Vales abertos', value: '05', meta: '2 vencem ainda hoje', badgeText: 'abertos', badgeClass: 'ui-badge--warning' },
      { label: 'Total liberado', value: 'R$ 420', meta: 'Janela atual do turno', badgeText: 'caixa', badgeClass: 'ui-badge--info' },
      { label: 'Baixas concluidas', value: '11', meta: 'Fechamento quase limpo', badgeText: 'ok', badgeClass: 'ui-badge--success' },
    ],
    panels: [
      {
        title: 'Pontos de atencao',
        items: [
          { label: 'Vale 092', value: 'Aguardando assinatura', tone: 'warning' },
          { label: 'Vale 088', value: 'Conferencia financeira', tone: 'danger' },
          { label: 'Vale 085', value: 'Baixa prevista 22:00', tone: 'info' },
        ],
      },
      {
        title: 'Fluxo de caixa',
        timeline: [
          { title: 'Ultimo lancamento', meta: 'R$ 80 liberados para pista leste' },
          { title: 'Conferencia parcial', meta: 'Saldo do caixa 02 alinhado com o turno' },
          { title: 'Previsao de fechamento', meta: 'Encerramento estimado sem pendencias criticas' },
        ],
      },
    ],
    table: {
      title: 'Vales em andamento',
      columns: ['Codigo', 'Operador', 'Valor', 'Estado'],
      rows: [
        ['092', 'Ana Vitoria', 'R$ 80', 'Aguardando'],
        ['088', 'Rosa', 'R$ 120', 'Conferencia'],
        ['085', 'Gabriel', 'R$ 60', 'Programado'],
      ],
    },
  },
  discounts: {
    metrics: [
      { label: 'Descontos ativos', value: '07', meta: '3 aguardando justificativa final', badgeText: 'revisao', badgeClass: 'ui-badge--warning' },
      { label: 'Impacto do turno', value: 'R$ 184', meta: '1,8% do faturamento parcial', badgeText: 'financeiro', badgeClass: 'ui-badge--info' },
      { label: 'Conferidos', value: '16', meta: 'Ultimas 24 horas', badgeText: 'ok', badgeClass: 'ui-badge--success' },
    ],
    panels: [
      {
        title: 'Categorias',
        items: [
          { label: 'Atraso', value: '3 registros', tone: 'danger' },
          { label: 'Cortesia', value: '2 registros', tone: 'special' },
          { label: 'Erro operacional', value: '2 registros', tone: 'warning' },
        ],
      },
      {
        title: 'Rastreamento',
        timeline: [
          { title: 'Maior desconto da noite', meta: 'Pedido #2105 - R$ 42 por atraso' },
          { title: 'Fila de justificativas', meta: '2 lancamentos aguardam supervisor' },
          { title: 'Nivel de risco', meta: 'Abaixo do limite do turno anterior' },
        ],
      },
    ],
    table: {
      title: 'Descontos recentes',
      columns: ['Pedido', 'Motivo', 'Valor', 'Status'],
      rows: [
        ['#2105', 'Atraso', 'R$ 42', 'Pendente'],
        ['#2099', 'Cortesia', 'R$ 18', 'Validado'],
        ['#2093', 'Erro item', 'R$ 24', 'Aprovado'],
      ],
    },
  },
  change: {
    metrics: [
      { label: 'Trocos abertos', value: '03', meta: '1 acima de R$ 100', badgeText: 'alerta', badgeClass: 'ui-badge--warning' },
      { label: 'Valor em circulacao', value: 'R$ 230', meta: 'Caixas 01 e 02', badgeText: 'caixa', badgeClass: 'ui-badge--info' },
      { label: 'Retornos confirmados', value: '09', meta: 'Turno atual', badgeText: 'ok', badgeClass: 'ui-badge--success' },
    ],
    panels: [
      {
        title: 'Solicitacoes abertas',
        items: [
          { label: 'Caixa 02', value: 'R$ 120', tone: 'warning' },
          { label: 'Pista norte', value: 'R$ 60', tone: 'info' },
          { label: 'Base sul', value: 'R$ 50', tone: 'success' },
        ],
      },
      {
        title: 'Proximos passos',
        timeline: [
          { title: 'Conferencia pendente', meta: 'Troco do caixa 02 aguardando retorno' },
          { title: 'Abastecimento liberado', meta: 'Pista norte recebeu sinal verde do caixa' },
          { title: 'Saldo projetado', meta: 'Encerramento previsto sem quebra de caixa' },
        ],
      },
    ],
    table: {
      title: 'Movimentacoes de troco',
      columns: ['Origem', 'Destino', 'Valor', 'Estado'],
      rows: [
        ['Caixa 02', 'Despacho', 'R$ 120', 'Pendente'],
        ['Caixa 01', 'Pista norte', 'R$ 60', 'Liberado'],
        ['Retorno', 'Base sul', 'R$ 50', 'Recebido'],
      ],
    },
  },
  machines: {
    metrics: [
      { label: 'Dispositivos ativos', value: '14', meta: '12 em pista e 2 de reserva', badgeText: 'online', badgeClass: 'ui-badge--success' },
      { label: 'Checklist pendente', value: '02', meta: 'Ultima ronda as 18:44', badgeText: 'fila', badgeClass: 'ui-badge--warning' },
      { label: 'Sem entregador', value: '01', meta: 'Uma unidade ainda precisa de atribuicao', badgeText: 'critico', badgeClass: 'ui-badge--danger' },
    ],
    panels: [
      {
        title: 'Parque atual',
        items: [
          { label: 'Em uso', value: '12 maquinas', tone: 'success' },
          { label: 'Reserva', value: '2 maquinas', tone: 'info' },
          { label: 'Manutencao', value: '1 slot em observacao', tone: 'warning' },
        ],
      },
      {
        title: 'Eventos recentes',
        timeline: [
          { title: 'Maq-08 reconectada', meta: 'Sinal estavel ha 14 min' },
          { title: 'Maq-12 em carga', meta: 'Retorno previsto para o proximo pico' },
          { title: 'Checklist pendente', meta: 'Equipe de pista recebe aviso em 7 min' },
        ],
      },
    ],
    table: {
      title: 'Inventario operacional',
      columns: ['Dispositivo', 'Entregador', 'Modelo', 'Estado'],
      rows: [
        ['Maq-03', 'Rafael', 'Stone S920', 'Em rota'],
        ['Maq-08', 'Gabriel', 'Moderninha Smart', 'Ativa'],
        ['Maq-12', 'Sem entregador', 'SumUp Solo', 'Carga'],
      ],
    },
  },
  'machine-history': {
    metrics: [
      { label: 'Checklist do dia', value: 'Ativo', meta: 'Confirme quais maquininhas estao presentes no turno', badgeText: 'check', badgeClass: 'ui-badge--info' },
      { label: 'Conferencia', value: 'Manual', meta: 'Base ligada ao cadastro real de maquininhas', badgeText: 'ok', badgeClass: 'ui-badge--success' },
      { label: 'Foco', value: 'Presenca', meta: 'Sem eventos tecnicos ou historico mockado', badgeText: 'turno', badgeClass: 'ui-badge--special' },
    ],
    panels: [
      {
        title: 'Leitura rapida',
        items: [
          { label: 'Checklist por maquininha', value: 'Marque presente ou ausente no turno', tone: 'info' },
          { label: 'Vinculo operacional', value: 'Usa entregador e modelo do cadastro atual', tone: 'success' },
          { label: 'Revisao do dia', value: 'Atualize conforme as unidades chegarem', tone: 'warning' },
        ],
      },
      {
        title: 'Como usar',
        timeline: [
          { title: 'Cadastre as maquininhas', meta: 'Inclua dispositivo, entregador e modelo no modulo principal' },
          { title: 'Abra o checklist do dia', meta: 'Marque as unidades que estao presentes no turno' },
          { title: 'Atualize conforme a operacao muda', meta: 'O status fica salvo localmente com horario e operador' },
        ],
      },
    ],
    table: {
      title: 'Checklist de maquininhas do dia',
      columns: ['Dispositivo', 'Entregador', 'Modelo', 'Presenca'],
      rows: [
        ['Maq-03', 'Rafael', 'Stone S920', 'Presente'],
        ['Maq-08', 'Gabriel', 'Moderninha Smart', 'Presente'],
        ['Maq-12', 'Sem entregador', 'SumUp Solo', 'Ausente'],
      ],
    },
  },
  map: {
    metrics: [
      { label: 'Bairros bloqueados', value: '03', meta: 'Locais sem entrega monitorados no Ze Delivery', badgeText: 'mapa', badgeClass: 'ui-badge--info' },
      { label: 'Confirmacoes ativas', value: '03', meta: 'Bloqueios locais confirmados pela operacao', badgeText: 'check', badgeClass: 'ui-badge--warning' },
      { label: 'Ultima revisao', value: '20 min', meta: 'Lista conferida pela operacao local', badgeText: 'ok', badgeClass: 'ui-badge--success' },
    ],
    panels: [
      {
        title: 'Bairros sem entrega',
        items: [
          { label: 'Nova Esperanca, Vale Azul', value: 'Nao entrega no local', tone: 'danger' },
          { label: 'Chacaras sul', value: 'Nao entrega no local', tone: 'warning' },
          { label: 'Avenida central e entorno', value: 'Nao entrega no local', tone: 'info' },
        ],
      },
      {
        title: 'Sinais operacionais',
        timeline: [
          { title: 'Lista de bairros revisada', meta: 'Operacao confirmou os locais sem entrega do turno' },
          { title: 'Bloqueio mantido no app', meta: 'Ze Delivery segue sem entrega nos bairros marcados' },
          { title: 'Consulta rapida atualizada', meta: 'Base pronta para conferencia durante o dia' },
        ],
      },
    ],
    table: {
      title: 'Bairros sem entrega',
      columns: ['Bairros', 'Nao entrega no local'],
      rows: [
        ['Avenida central e entorno', 'Confirmado'],
        ['Nova Esperanca, Vale Azul', 'Confirmado'],
        ['Setor rural sul', 'Confirmado'],
      ],
    },
  },
  history: {
    metrics: [
      { label: 'Dias consultados', value: '14', meta: 'Janela mais usada pela operacao', badgeText: 'historico', badgeClass: 'ui-badge--info' },
      { label: 'Melhor fechamento', value: 'Sab', meta: 'R$ 8.420 no ultimo ciclo', badgeText: 'topo', badgeClass: 'ui-badge--success' },
      { label: 'Dia atipico', value: 'Qua', meta: 'Ocorrencias acima do padrao', badgeText: 'revisao', badgeClass: 'ui-badge--warning' },
    ],
    panels: [
      {
        title: 'Leitura rapida',
        items: [
          { label: 'Vendas', value: 'Tendencia de alta', tone: 'success' },
          { label: 'Ocorrencias', value: '1 dia fora da curva', tone: 'warning' },
          { label: 'Comissao', value: 'Estavel na semana', tone: 'info' },
        ],
      },
      {
        title: 'Ultimas consultas',
        timeline: [
          { title: '08/03 revisado', meta: 'Turno com pico forte no jantar' },
          { title: '07/03 comparado', meta: 'Financeiro fechou acima da meta' },
          { title: '06/03 arquivado', meta: 'Sem desvios operacionais relevantes' },
        ],
      },
    ],
    table: {
      title: 'Dias recentes',
      columns: ['Data', 'Pedidos', 'Faturamento', 'Leitura'],
      rows: [
        ['08/03', '182', 'R$ 8.420', 'Alta'],
        ['07/03', '168', 'R$ 7.980', 'Estavel'],
        ['06/03', '149', 'R$ 7.115', 'Normal'],
      ],
    },
  },
  occurrences: {
    metrics: [
      { label: 'Ocorrencias abertas', value: '04', meta: '2 em tratamento imediato', badgeText: 'critico', badgeClass: 'ui-badge--danger' },
      { label: 'Resolvidas hoje', value: '12', meta: 'Resposta media de 18 min', badgeText: 'ok', badgeClass: 'ui-badge--success' },
      { label: 'Tempo medio', value: '18 min', meta: 'SLA dentro da meta', badgeText: 'controle', badgeClass: 'ui-badge--info' },
    ],
    panels: [
      {
        title: 'Fila de tratamento',
        items: [
          { label: 'Atraso de retorno', value: '2 casos', tone: 'danger' },
          { label: 'Falha de maquininha', value: '1 caso', tone: 'warning' },
          { label: 'Divergencia de caixa', value: '1 caso', tone: 'info' },
        ],
      },
      {
        title: 'Acompanhamento',
        timeline: [
          { title: 'Oc-214 em triagem', meta: 'Supervisor ja acionado' },
          { title: 'Oc-210 resolvida', meta: 'Troca de equipamento concluida' },
          { title: 'Oc-205 fechada', meta: 'Cliente notificado sem reabertura' },
        ],
      },
    ],
    table: {
      title: 'Ocorrencias recentes',
      columns: ['Codigo', 'Tipo', 'Responsavel', 'Estado'],
      rows: [
        ['Oc-214', 'Atraso', 'Rafael', 'Em triagem'],
        ['Oc-210', 'Hardware', 'Gabriel', 'Resolvida'],
        ['Oc-205', 'Financeiro', 'Rosa', 'Fechada'],
      ],
    },
  },
  'monthly-report': {
    metrics: [
      { label: 'Faturamento mensal', value: 'R$ 186k', meta: '8% acima do mes anterior', badgeText: 'crescimento', badgeClass: 'ui-badge--success' },
      { label: 'Ticket medio', value: 'R$ 46', meta: 'Estavel nas ultimas 4 semanas', badgeText: 'consistente', badgeClass: 'ui-badge--info' },
      { label: 'Ponto de atencao', value: 'Segundas', meta: 'Menor conversao do calendario', badgeText: 'revisao', badgeClass: 'ui-badge--warning' },
    ],
    panels: [
      {
        title: 'Resumo executivo',
        items: [
          { label: 'Melhor semana', value: 'Semana 2', tone: 'success' },
          { label: 'Maior pressao', value: 'Fechamento de sexta', tone: 'warning' },
          { label: 'Retencao', value: 'Acima da meta', tone: 'info' },
        ],
      },
      {
        title: 'Narrativa mensal',
        timeline: [
          { title: 'Inicio forte de mes', meta: 'Volume acima do previsto nos dias 1-5' },
          { title: 'Ajuste de escala', meta: 'Reforco noturno melhorou SLA na semana 2' },
          { title: 'Fechamento estavel', meta: 'Sem desvios relevantes no caixa final' },
        ],
      },
    ],
    table: {
      title: 'Comparativo mensal',
      columns: ['Periodo', 'Pedidos', 'Faturamento', 'Variacao'],
      rows: [
        ['Mes atual', '4.031', 'R$ 186k', '+8%'],
        ['Mes anterior', '3.781', 'R$ 172k', '--'],
        ['Media 3m', '3.844', 'R$ 176k', '+5%'],
      ],
    },
  },
  'orders-hour': {
    metrics: [
      { label: 'Pico horario', value: '20h', meta: 'Janela com maior demanda do turno', badgeText: 'pico', badgeClass: 'ui-badge--warning' },
      { label: 'Media por hora', value: '17', meta: 'Distribuicao saudavel na noite', badgeText: 'media', badgeClass: 'ui-badge--info' },
      { label: 'Hora critica', value: '21h', meta: 'Tempo medio sobe junto com volume', badgeText: 'alerta', badgeClass: 'ui-badge--danger' },
    ],
    panels: [
      {
        title: 'Faixas do turno',
        items: [
          { label: '18h', value: '12 pedidos', tone: 'info' },
          { label: '20h', value: '29 pedidos', tone: 'warning' },
          { label: '22h', value: '16 pedidos', tone: 'success' },
        ],
      },
      {
        title: 'Leitura operacional',
        timeline: [
          { title: '19h ganha tracao', meta: 'Fila cresce 31% contra a hora anterior' },
          { title: '20h exige reforco', meta: 'Despacho pede maquininha extra' },
          { title: '22h estabiliza', meta: 'Tempo de entrega volta ao nivel ideal' },
        ],
      },
    ],
    table: {
      title: 'Pedidos por faixa',
      columns: ['Hora', 'Pedidos', 'Tempo medio', 'Leitura'],
      rows: [
        ['18h', '12', '24 min', 'Aquecimento'],
        ['20h', '29', '31 min', 'Pico'],
        ['22h', '16', '25 min', 'Retorno'],
      ],
    },
  },
  ratings: {
    metrics: [
      { label: 'Nota media', value: '4.7', meta: 'Base das ultimas 48 horas', badgeText: 'alto', badgeClass: 'ui-badge--success' },
      { label: 'Avaliacoes novas', value: '38', meta: 'Turno em andamento', badgeText: 'feedback', badgeClass: 'ui-badge--info' },
      { label: 'Acoes abertas', value: '03', meta: 'Casos com retorno necessario', badgeText: 'atencao', badgeClass: 'ui-badge--warning' },
    ],
    panels: [
      {
        title: 'Sinais de experiencia',
        items: [
          { label: 'Entrega rapida', value: '18 mencoes', tone: 'success' },
          { label: 'Atendimento', value: '12 mencoes', tone: 'info' },
          { label: 'Atraso', value: '3 mencoes', tone: 'warning' },
        ],
      },
      {
        title: 'Follow-up',
        timeline: [
          { title: 'Cliente VIP contatado', meta: 'Caso fechado sem reabertura' },
          { title: 'Pedido #2105 em analise', meta: 'Reclamacao ligada a atraso da zona norte' },
          { title: 'Pista leste reconhecida', meta: 'Melhor nota da semana na base atual' },
        ],
      },
    ],
    table: {
      title: 'Feedback recente',
      columns: ['Origem', 'Nota', 'Motivo', 'Acompanhamento'],
      rows: [
        ['App', '5.0', 'Entrega rapida', 'Nenhum'],
        ['WhatsApp', '3.5', 'Atraso', 'Contato aberto'],
        ['Balcao', '4.8', 'Atendimento', 'Concluido'],
      ],
    },
  },
  'audit-log': {
    metrics: [
      { label: 'Eventos registrados', value: '184', meta: 'Ultimas 24 horas', badgeText: 'log', badgeClass: 'ui-badge--info' },
      { label: 'Acoes sensiveis', value: '09', meta: 'Todas com rastreio completo', badgeText: 'seguro', badgeClass: 'ui-badge--success' },
      { label: 'Desvios', value: '01', meta: 'Editar permissao de turno', badgeText: 'revisar', badgeClass: 'ui-badge--warning' },
    ],
    panels: [
      {
        title: 'Pontos de rastreio',
        items: [
          { label: 'Financeiro', value: '42 eventos', tone: 'info' },
          { label: 'Pedidos', value: '88 eventos', tone: 'success' },
          { label: 'Sistema', value: '54 eventos', tone: 'warning' },
        ],
      },
      {
        title: 'Sequencia recente',
        timeline: [
          { title: '20:14 - permissao atualizada', meta: 'Supervisor alterou papel operacional' },
          { title: '20:22 - PIN revisado', meta: 'Acesso local reforcado em settings' },
          { title: '20:37 - sessao encerrada', meta: 'Logout manual do operador' },
        ],
      },
    ],
    table: {
      title: 'Eventos recentes',
      columns: ['Horario', 'Actor', 'Acao', 'Modulo'],
      rows: [
        ['20:14', 'Gabriel', 'Atualizou perfil', 'Sistema'],
        ['20:22', 'Rosa', 'Alterou PIN', 'Configuracoes'],
        ['20:37', 'Rafael', 'Lock manual', 'Sessao'],
      ],
    },
  },
  pos: {
    metrics: [
      { label: 'Cestas montadas', value: '12', meta: '4 aguardando fechamento', badgeText: 'pdv', badgeClass: 'ui-badge--info' },
      { label: 'Ticket medio', value: 'R$ 52', meta: 'Acima da media da noite', badgeText: 'alto', badgeClass: 'ui-badge--success' },
      { label: 'Pendencias de cadastro', value: '02', meta: 'Clientes sem complemento', badgeText: 'revisar', badgeClass: 'ui-badge--warning' },
    ],
    panels: [
      {
        title: 'Fila de montagem',
        items: [
          { label: 'Balcao', value: '4 pedidos', tone: 'info' },
          { label: 'Delivery', value: '6 pedidos', tone: 'warning' },
          { label: 'Retirada', value: '2 pedidos', tone: 'success' },
        ],
      },
      {
        title: 'Ritmo comercial',
        timeline: [
          { title: 'Combo premium em alta', meta: 'Categoria puxando o ticket medio' },
          { title: 'Endereco novo validado', meta: 'Cadastro aprovado no primeiro contato' },
          { title: 'Fila de entrega organizada', meta: 'Tempo de saida controlado no pico' },
        ],
      },
    ],
    table: {
      title: 'Pedidos em montagem',
      columns: ['Cliente', 'Canal', 'Valor', 'Estado'],
      rows: [
        ['Julia Moraes', 'WhatsApp', 'R$ 74', 'Montagem'],
        ['Carlos Lima', 'Balcao', 'R$ 38', 'Pagamento'],
        ['Marina S.', 'App', 'R$ 51', 'Despacho'],
      ],
    },
  },
  sales: {
    metrics: [
      { label: 'Vendas do turno', value: 'R$ 8.420', meta: '8% acima da meta parcial', badgeText: 'meta', badgeClass: 'ui-badge--success' },
      { label: 'Conversao', value: '34%', meta: 'Canal mais forte: WhatsApp', badgeText: 'mix', badgeClass: 'ui-badge--info' },
      { label: 'Cancelamentos', value: '02', meta: 'Sem desvio relevante', badgeText: 'controle', badgeClass: 'ui-badge--warning' },
    ],
    panels: [
      {
        title: 'Mix de canais',
        items: [
          { label: 'WhatsApp', value: '41%', tone: 'success' },
          { label: 'App', value: '33%', tone: 'info' },
          { label: 'Balcao', value: '26%', tone: 'special' },
        ],
      },
      {
        title: 'Narrativa de vendas',
        timeline: [
          { title: '19h concentrou upgrades', meta: 'Itens premium puxaram o ticket' },
          { title: '20h manteve caixa forte', meta: 'Baixo indice de desconto na faixa' },
          { title: '21h estabilizou fila', meta: 'Retirada ganhou mais participacao' },
        ],
      },
    ],
    table: {
      title: 'Vendas recentes',
      columns: ['Pedido', 'Canal', 'Valor', 'Situacao'],
      rows: [
        ['#2105', 'WhatsApp', 'R$ 74', 'Concluida'],
        ['#2102', 'App', 'R$ 58', 'Em entrega'],
        ['#2098', 'Balcao', 'R$ 32', 'Concluida'],
      ],
    },
  },
  products: {
    metrics: [
      { label: 'Itens ativos', value: '126', meta: '9 em destaque comercial', badgeText: 'catalogo', badgeClass: 'ui-badge--info' },
      { label: 'Rupturas', value: '03', meta: 'Monitorar antes do pico final', badgeText: 'estoque', badgeClass: 'ui-badge--warning' },
      { label: 'Mais vendidos', value: 'Burger X', meta: 'Lider nas ultimas 24 horas', badgeText: 'topo', badgeClass: 'ui-badge--success' },
    ],
    panels: [
      {
        title: 'Categorias quentes',
        items: [
          { label: 'Combos', value: '32 itens', tone: 'success' },
          { label: 'Bebidas', value: '18 itens', tone: 'info' },
          { label: 'Sobremesas', value: '11 itens', tone: 'special' },
        ],
      },
      {
        title: 'Sinais de catalogo',
        timeline: [
          { title: 'Preco do combo revisado', meta: 'Melhor margem sem afetar volume' },
          { title: 'Ruptura prevista', meta: 'Milkshake entra em pausa as 22h' },
          { title: 'Cardapio enxuto', meta: 'Categoria premium com maior conversao' },
        ],
      },
    ],
    table: {
      title: 'Catalogo monitorado',
      columns: ['Produto', 'Categoria', 'Preco', 'Estado'],
      rows: [
        ['Burger X', 'Combos', 'R$ 32', 'Ativo'],
        ['Milkshake Choco', 'Sobremesa', 'R$ 18', 'Baixo estoque'],
        ['Refri 2L', 'Bebidas', 'R$ 14', 'Ativo'],
      ],
    },
  },
  customers: {
    metrics: [
      { label: 'Clientes ativos', value: '248', meta: '48 retornaram nesta semana', badgeText: 'crm', badgeClass: 'ui-badge--info' },
      { label: 'Frequentes', value: '62', meta: 'Pedidos recorrentes nos ultimos 30 dias', badgeText: 'fidelidade', badgeClass: 'ui-badge--success' },
      { label: 'Atencao especial', value: '06', meta: 'Acompanhar experiencia e SLA', badgeText: 'vip', badgeClass: 'ui-badge--warning' },
    ],
    panels: [
      {
        title: 'Relacionamento',
        items: [
          { label: 'Novos', value: '14 clientes', tone: 'info' },
          { label: 'Recorrentes', value: '62 clientes', tone: 'success' },
          { label: 'Recuperacao', value: '6 clientes', tone: 'warning' },
        ],
      },
      {
        title: 'Ultimos movimentos',
        timeline: [
          { title: 'VIP reativado', meta: 'Cliente voltou apos campanha local' },
          { title: 'Endereco confirmado', meta: 'Zona externa liberada com novo ponto' },
          { title: 'Feedback recebido', meta: 'Atendimento foi elogiado no pico' },
        ],
      },
    ],
    table: {
      title: 'Clientes em foco',
      columns: ['Cliente', 'Ultimo pedido', 'Ticket', 'Perfil'],
      rows: [
        ['Julia Moraes', 'Hoje 20:14', 'R$ 74', 'VIP'],
        ['Carlos Lima', 'Hoje 19:40', 'R$ 38', 'Recorrente'],
        ['Marina Souza', 'Ontem 21:08', 'R$ 51', 'Novo'],
      ],
    },
  },
  'pos-reports': {
    metrics: [
      { label: 'Relatorios salvos', value: '18', meta: '3 favoritos da operacao', badgeText: 'pdv', badgeClass: 'ui-badge--info' },
      { label: 'Periodo mais consultado', value: '7 dias', meta: 'Leitura padrao de lideranca', badgeText: 'padrao', badgeClass: 'ui-badge--success' },
      { label: 'Exportacoes do dia', value: '04', meta: 'Sem falhas de geracao', badgeText: 'ok', badgeClass: 'ui-badge--special' },
    ],
    panels: [
      {
        title: 'Consultas quentes',
        items: [
          { label: 'Canal de venda', value: 'Mais acessado', tone: 'info' },
          { label: 'Itens premium', value: 'Em crescimento', tone: 'success' },
          { label: 'Descontos por faixa', value: 'Em revisao', tone: 'warning' },
        ],
      },
      {
        title: 'Rotina analitica',
        timeline: [
          { title: 'Relatorio semanal gerado', meta: 'Comparativo enviado ao fechamento' },
          { title: 'Top produtos cruzado', meta: 'Mix comercial atualizado pela operacao' },
          { title: 'Exportacao PDV pronta', meta: 'Arquivo fechado para conferencia' },
        ],
      },
    ],
    table: {
      title: 'Ultimas geracoes',
      columns: ['Relatorio', 'Periodo', 'Formato', 'Estado'],
      rows: [
        ['Canal de venda', '7 dias', 'PDF', 'Concluido'],
        ['Produtos premium', '30 dias', 'XLSX', 'Concluido'],
        ['Descontos por faixa', 'Hoje', 'CSV', 'Processando'],
      ],
    },
  },
};

function formatAuditTime(timestamp) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function formatAuditDate(timestamp) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(timestamp));
}

function buildHistoryContent() {
  const events = loadAuditEvents();

  if (events.length === 0) {
    return {
      metrics: [
        { label: 'Dias com atividade', value: '00', meta: 'Nenhum evento local registrado ainda', badgeText: 'historico', badgeClass: 'ui-badge--info' },
        { label: 'Ultimo movimento', value: '--', meta: 'O historico sera alimentado pelas operacoes locais', badgeText: 'aguardando', badgeClass: 'ui-badge--warning' },
        { label: 'Base auditavel', value: 'Pronta', meta: 'Novos eventos aparecerao automaticamente', badgeText: 'ok', badgeClass: 'ui-badge--success' },
      ],
      panels: [
        {
          title: 'Leitura rapida',
          items: [
            { label: 'Historico local', value: 'Sem eventos', tone: 'info' },
            { label: 'Origem', value: 'Modulos manuais', tone: 'special' },
            { label: 'Estado', value: 'Aguardando atividade', tone: 'warning' },
          ],
        },
        {
          title: 'Ultimos movimentos',
          timeline: [
            { title: 'Sem eventos locais', meta: 'Cadastros, validacoes e exclusoes aparecerao aqui.' },
          ],
        },
      ],
      table: {
        title: 'Dias recentes',
        columns: ['Data', 'Eventos', 'Ultimo ator', 'Leitura'],
        rows: [],
      },
    };
  }

  const groupedByDate = events.reduce((accumulator, event) => {
    const dateKey = formatAuditDate(event.timestamp);
    const bucket = accumulator.get(dateKey) ?? [];
    bucket.push(event);
    accumulator.set(dateKey, bucket);
    return accumulator;
  }, new Map());

  const dayEntries = Array.from(groupedByDate.entries());
  const mostActiveDay = dayEntries.reduce((best, current) => (
    !best || current[1].length > best[1].length ? current : best
  ), null);
  const uniqueModules = new Set(events.map((event) => event.module));

  return {
    metrics: [
      { label: 'Dias com atividade', value: String(dayEntries.length).padStart(2, '0'), meta: 'Historico local consolidado por dia', badgeText: 'historico', badgeClass: 'ui-badge--info' },
      { label: 'Dia mais ativo', value: mostActiveDay?.[0] ?? '--', meta: `${mostActiveDay?.[1].length ?? 0} eventos registrados`, badgeText: 'topo', badgeClass: 'ui-badge--success' },
      { label: 'Modulos auditados', value: String(uniqueModules.size).padStart(2, '0'), meta: 'Areas que ja geraram rastro operacional', badgeText: 'auditoria', badgeClass: 'ui-badge--special' },
    ],
    panels: [
      {
        title: 'Leitura rapida',
        items: Array.from(uniqueModules).slice(0, 3).map((moduleName) => ({
          label: moduleName,
          value: `${events.filter((event) => event.module === moduleName).length} eventos`,
          tone: 'info',
        })),
      },
      {
        title: 'Ultimos movimentos',
        timeline: events.slice(0, 3).map((event) => ({
          title: `${formatAuditDate(event.timestamp)} - ${event.action}`,
          meta: `${event.actor} em ${event.module}`,
        })),
      },
    ],
    table: {
      title: 'Dias recentes',
      columns: ['Data', 'Eventos', 'Ultimo ator', 'Leitura'],
      rows: dayEntries.slice(0, 7).map(([date, dayEvents]) => ([
        date,
        String(dayEvents.length),
        dayEvents[0]?.actor ?? '--',
        `${new Set(dayEvents.map((event) => event.module)).size} modulos`,
      ])),
    },
  };
}

function buildAuditLogContent() {
  const events = loadAuditEvents();

  if (events.length === 0) {
    return {
      metrics: [
        { label: 'Eventos registrados', value: '00', meta: 'Nenhum evento local no audit log ainda', badgeText: 'log', badgeClass: 'ui-badge--info' },
        { label: 'Atores ativos', value: '00', meta: 'Sem operadores com eventos rastreados', badgeText: 'atores', badgeClass: 'ui-badge--warning' },
        { label: 'Cobertura', value: 'Pronta', meta: 'Cadastros e alteracoes passarao a alimentar o log', badgeText: 'ok', badgeClass: 'ui-badge--success' },
      ],
      panels: [
        {
          title: 'Pontos de rastreio',
          items: [
            { label: 'Eventos locais', value: '0 registros', tone: 'info' },
            { label: 'Origem', value: 'Operacao manual', tone: 'special' },
            { label: 'Estado', value: 'Aguardando atividade', tone: 'warning' },
          ],
        },
        {
          title: 'Sequencia recente',
          timeline: [
            { title: 'Sem eventos', meta: 'O audit log sera preenchido automaticamente pelas acoes do app.' },
          ],
        },
      ],
      table: {
        title: 'Eventos recentes',
        columns: ['Horario', 'Actor', 'Acao', 'Modulo'],
        rows: [],
      },
    };
  }

  const uniqueActors = new Set(events.map((event) => event.actor));
  const moduleCounts = events.reduce((accumulator, event) => {
    accumulator[event.module] = (accumulator[event.module] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    metrics: [
      { label: 'Eventos registrados', value: String(events.length).padStart(2, '0'), meta: 'Rastro local das ultimas acoes', badgeText: 'log', badgeClass: 'ui-badge--info' },
      { label: 'Atores ativos', value: String(uniqueActors.size).padStart(2, '0'), meta: 'Usuarios que deixaram rastro no shell', badgeText: 'atores', badgeClass: 'ui-badge--success' },
      { label: 'Modulos tocados', value: String(Object.keys(moduleCounts).length).padStart(2, '0'), meta: 'Areas que geraram eventos no audit log', badgeText: 'cobertura', badgeClass: 'ui-badge--special' },
    ],
    panels: [
      {
        title: 'Pontos de rastreio',
        items: Object.entries(moduleCounts).slice(0, 3).map(([moduleName, count]) => ({
          label: moduleName,
          value: `${count} eventos`,
          tone: 'info',
        })),
      },
      {
        title: 'Sequencia recente',
        timeline: events.slice(0, 3).map((event) => ({
          title: `${formatAuditTime(event.timestamp)} - ${event.action}`,
          meta: `${event.actor} | ${event.module}`,
        })),
      },
    ],
    table: {
      title: 'Eventos recentes',
      columns: ['Horario', 'Actor', 'Acao', 'Modulo'],
      rows: events.slice(0, 12).map((event) => ([
        formatAuditTime(event.timestamp),
        event.actor,
        event.action,
        event.module,
      ])),
    },
  };
}

function buildFallbackContent(route) {
  return {
    metrics: [
      { label: 'Visibilidade', value: 'Alta', meta: `${route.section} pronto para operacao`, badgeText: 'nativo', badgeClass: 'ui-badge--info' },
      { label: 'Cobertura', value: '100%', meta: `Fluxo de ${route.label.toLowerCase()} ativo no shell React`, badgeText: 'ok', badgeClass: 'ui-badge--success' },
      { label: 'Ajustes', value: '03', meta: 'Espaco preparado para evolucoes modulares', badgeText: 'roadmap', badgeClass: 'ui-badge--special' },
    ],
    panels: [
      {
        title: 'Leitura rapida',
        items: [
          { label: 'Modulo', value: route.title, tone: 'info' },
          { label: 'Secao', value: route.section, tone: 'success' },
          { label: 'Estado', value: 'Operacional', tone: 'special' },
        ],
      },
      {
        title: 'Contexto',
        timeline: [
          { title: 'Interface migrada para React', meta: 'Sem dependencia do host legado' },
          { title: 'Visual padronizado', meta: 'Tokens, cards e tabela seguem o shell atual' },
          { title: 'Base pronta para evolucao', meta: 'Incrementos futuros entram sem iframe antigo' },
        ],
      },
    ],
    table: {
      title: 'Resumo do modulo',
      columns: ['Campo', 'Valor', 'Leitura', 'Status'],
      rows: [
        ['Modulo', route.label, 'Nativo', 'Ativo'],
        ['Secao', route.section, 'Shell React', 'Online'],
        ['Experiencia', 'Padronizada', 'Design system', 'Pronto'],
      ],
    },
  };
}

export function getNativeModuleContent(route) {
  if (route.path === 'history') {
    return buildHistoryContent();
  }

  if (route.path === 'audit-log') {
    return buildAuditLogContent();
  }

  return moduleContentByPath[route.path] ?? buildFallbackContent(route);
}
