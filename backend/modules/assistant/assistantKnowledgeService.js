function buildHelpResponse(title, answer, suggestions = []) {
  return {
    title,
    answer,
    suggestions,
  };
}

const knowledgeEntries = [
  {
    match: (text) => text.includes('diferenca') && text.includes('pedido') && text.includes('venda'),
    response: buildHelpResponse(
      'Pedido x venda',
      'Pedido é um registro comercial e operacional. Venda é o evento real que baixa estoque, cria financeiro e registra auditoria.',
      ['Novo pedido', 'Nova venda', 'Ajuda sobre pedidos'],
    ),
  },
  {
    match: (text) => text.includes('gerar venda') || (text.includes('como') && text.includes('venda')),
    response: buildHelpResponse(
      'Como gerar uma venda',
      'Você pode criar uma venda direta em Vendas ou gerar uma venda a partir de um pedido no detalhe do pedido usando o botão Gerar venda.',
      ['Nova venda', 'Lista de pedidos', 'Vendas de hoje'],
    ),
  },
  {
    match: (text) => text.includes('cadastrar cliente') || (text.includes('como') && text.includes('cliente')),
    response: buildHelpResponse(
      'Como cadastrar cliente',
      'Abra o módulo Clientes, use o formulário principal para informar nome, telefone e endereço, e salve o cadastro para usar depois em pedidos e vendas.',
      ['Abrir clientes', 'Buscar cliente', 'Novo pedido'],
    ),
  },
  {
    match: (text) => text.includes('pedido'),
    response: buildHelpResponse(
      'Ajuda sobre pedidos',
      'Pedidos servem para organizar atendimento, itens, cliente e entrega sem mexer em estoque ou financeiro. Depois, se precisar, você gera uma venda.',
      ['Novo pedido', 'Buscar pedido', 'Qual a diferença entre pedido e venda'],
    ),
  },
  {
    match: (text) => text.includes('venda'),
    response: buildHelpResponse(
      'Ajuda sobre vendas',
      'Vendas representam o evento publicado da operação. Elas baixam estoque, criam financeiro e ficam disponíveis para acompanhamento no módulo de vendas.',
      ['Nova venda', 'Vendas de hoje', 'Abrir vendas'],
    ),
  },
];

export function resolveKnowledgeAnswer(message, context = {}) {
  const normalizedText = String(message ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  const match = knowledgeEntries.find((entry) => entry.match(normalizedText));

  if (!match) {
    return buildHelpResponse(
      'Ajuda geral',
      context.routeTitle
        ? `Posso ajudar com o módulo ${context.routeTitle}. Pergunte sobre fluxo, diferença entre módulos ou como navegar pelo ERP.`
        : 'Posso explicar como funcionam pedidos, vendas, clientes, produtos e navegação do ERP.',
      ['Ajuda sobre pedidos', 'Nova venda', 'Abrir clientes'],
    );
  }

  return match.response;
}
