const INTENTS = {
  help: 'HELP_INTENT',
  navigation: 'NAVIGATION_INTENT',
  search: 'SEARCH_INTENT',
  unknown: 'UNKNOWN_INTENT',
};

const navigationMap = [
  { pattern: /\b(novo pedido|abrir pedidos|ir para pedidos|pedidos)\b/i, route: '/orders', label: 'Pedidos' },
  { pattern: /\b(nova venda|abrir vendas|ir para vendas|vendas)\b/i, route: '/sales', label: 'Vendas' },
  { pattern: /\b(clientes|abrir clientes|ir para clientes|novo cliente)\b/i, route: '/customers', label: 'Clientes' },
  { pattern: /\b(produtos|abrir produtos|ir para produtos)\b/i, route: '/products', label: 'Produtos' },
  { pattern: /\b(estoque|abrir estoque|ir para estoque)\b/i, route: '/inventory', label: 'Estoque' },
  { pattern: /\b(entregadores|abrir entregadores|ir para entregadores)\b/i, route: '/couriers', label: 'Entregadores' },
];

function normalizeText(message) {
  return String(message ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function matchNavigationIntent(text) {
  return navigationMap.find((entry) => entry.pattern.test(text)) ?? null;
}

function inferSearchEntity(text) {
  if (text.includes('venda')) {
    return 'sales';
  }

  if (text.includes('pedido')) {
    return 'orders';
  }

  if (text.includes('cliente')) {
    return 'customers';
  }

  if (text.includes('produto')) {
    return 'products';
  }

  return 'overview';
}

export function resolveAssistantIntent(message) {
  const normalizedText = normalizeText(message);

  if (!normalizedText) {
    return {
      type: INTENTS.unknown,
      normalizedText,
      route: null,
      entity: null,
    };
  }

  const navigationMatch = matchNavigationIntent(normalizedText);
  const isHelpIntent = /\b(ajuda|como|diferenca|diferen[a-z]*|funciona|o que e|gerar venda|cadastrar cliente)\b/i.test(normalizedText);
  const isSearchIntent = /\b(buscar|buscar pedido|buscar cliente|buscar produto|mostrar|procurar|listar|vendas de hoje|pedidos de hoje|ifood)\b/i.test(normalizedText);

  if (isHelpIntent) {
    return {
      type: INTENTS.help,
      normalizedText,
      route: navigationMatch?.route ?? null,
      entity: inferSearchEntity(normalizedText),
    };
  }

  if (isSearchIntent) {
    return {
      type: INTENTS.search,
      normalizedText,
      route: navigationMatch?.route ?? null,
      entity: inferSearchEntity(normalizedText),
    };
  }

  if (navigationMatch) {
    return {
      type: INTENTS.navigation,
      normalizedText,
      route: navigationMatch.route,
      routeLabel: navigationMatch.label,
      entity: inferSearchEntity(normalizedText),
    };
  }

  return {
    type: INTENTS.unknown,
    normalizedText,
    route: null,
    entity: inferSearchEntity(normalizedText),
  };
}

export { INTENTS };
