import { resolveAssistantIntent, INTENTS } from './assistantIntentResolver.js';
import { resolveKnowledgeAnswer } from './assistantKnowledgeService.js';
import { createAssistantQueryService } from './assistantQueryService.js';

const queryService = createAssistantQueryService();

function buildNavigationResponse(intent) {
  return {
    intentType: intent.type,
    title: 'Navegação assistida',
    answer: intent.route
      ? `Posso te levar direto para ${intent.routeLabel ?? 'o módulo solicitado'}.`
      : 'Não identifiquei um módulo específico para abrir.',
    cards: [],
    navigationTarget: intent.route
      ? { route: intent.route, label: intent.routeLabel ?? 'Abrir módulo' }
      : null,
    suggestions: ['Novo pedido', 'Nova venda', 'Abrir clientes'],
  };
}

function buildEmptySearchResponse(entity) {
  const labelMap = {
    orders: 'pedido',
    sales: 'venda',
    customers: 'cliente',
    products: 'produto',
    overview: 'registro',
  };

  return {
    intentType: INTENTS.search,
    title: 'Busca operacional',
    answer: `Não encontrei ${labelMap[entity] ?? 'registro'} com esse critério agora.`,
    cards: [],
    navigationTarget: null,
    suggestions: ['Buscar pedido', 'Buscar cliente', 'Vendas de hoje'],
  };
}

async function resolveSearchResponse({ storeId, intent, message }) {
  let cards = [];

  if (intent.entity === 'sales' || intent.normalizedText.includes('venda')) {
    cards = await queryService.searchSales({ storeId, text: message });
  } else if (intent.entity === 'orders' || intent.normalizedText.includes('pedido')) {
    cards = await queryService.searchOrders({ storeId, text: message });
  } else if (intent.entity === 'customers' || intent.normalizedText.includes('cliente')) {
    cards = await queryService.searchCustomers({ storeId, text: message });
  } else if (intent.entity === 'products' || intent.normalizedText.includes('produto')) {
    cards = await queryService.searchProducts({ storeId, text: message });
  } else {
    cards = await queryService.searchSales({ storeId, text: message });
  }

  if (cards.length === 0) {
    return buildEmptySearchResponse(intent.entity);
  }

  return {
    intentType: INTENTS.search,
    title: 'Busca operacional',
    answer: `Encontrei ${cards.length} resultado${cards.length > 1 ? 's' : ''} para você consultar agora.`,
    cards,
    navigationTarget: cards[0]?.route ? { route: cards[0].route, label: 'Abrir primeiro resultado' } : null,
    suggestions: ['Buscar pedido', 'Buscar cliente', 'Vendas de hoje'],
  };
}

export async function handleAssistantQuery({ storeId, message, context = {} }) {
  const intent = resolveAssistantIntent(message);

  if (intent.type === INTENTS.help) {
    const helpResponse = resolveKnowledgeAnswer(message, context);

    return {
      intentType: intent.type,
      title: helpResponse.title,
      answer: helpResponse.answer,
      cards: [],
      navigationTarget: intent.route ? { route: intent.route, label: 'Abrir modulo relacionado' } : null,
      suggestions: helpResponse.suggestions,
    };
  }

  if (intent.type === INTENTS.navigation) {
    return buildNavigationResponse(intent);
  }

  if (intent.type === INTENTS.search) {
    try {
      return await resolveSearchResponse({ storeId, intent, message });
    } catch (error) {
      return {
        intentType: intent.type,
        title: 'Busca operacional',
        answer: 'Não consegui consultar os dados agora. Posso continuar ajudando com navegação e explicações do sistema.',
        cards: [],
        navigationTarget: null,
        suggestions: ['Ajuda sobre pedidos', 'Abrir clientes', 'Nova venda'],
      };
    }
  }

  return {
    intentType: INTENTS.unknown,
    title: 'NEXA',
    answer: 'Posso ajudar com explicações do sistema, navegação entre módulos e busca segura por pedidos, vendas, clientes e produtos.',
    cards: [],
    navigationTarget: null,
    suggestions: ['Ajuda sobre pedidos', 'Nova venda', 'Buscar cliente'],
  };
}
