import { resolveAssistantIntent, INTENTS } from './assistantIntentResolver.js'
import { resolveKnowledgeAnswer } from './assistantKnowledgeService.js'
import { createAssistantQueryService } from './assistantQueryService.js'
import { queryLLM } from './assistantLLMService.js'

const queryService = createAssistantQueryService()

function buildNavigationResponse(intent) {
  return {
    intentType: intent.type,
    title: 'Navegacao assistida',
    answer: intent.route
      ? `Posso te levar direto para ${intent.routeLabel ?? 'o modulo solicitado'}.`
      : 'Nao identifiquei um modulo especifico para abrir.',
    cards: [],
    navigationTarget: intent.route
      ? { route: intent.route, label: intent.routeLabel ?? 'Abrir modulo' }
      : null,
    suggestions: ['Novo pedido', 'Nova venda', 'Abrir clientes'],
  }
}

function buildEmptySearchResponse(entity) {
  const labelMap = {
    orders: 'pedido',
    sales: 'venda',
    customers: 'cliente',
    products: 'produto',
    overview: 'registro',
  }

  return {
    intentType: INTENTS.search,
    title: 'Busca operacional',
    answer: `Nao encontrei ${labelMap[entity] ?? 'registro'} com esse criterio agora.`,
    cards: [],
    navigationTarget: null,
    suggestions: ['Buscar pedido', 'Buscar cliente', 'Vendas de hoje'],
  }
}

function buildSearchErrorResponse(intentType) {
  return {
    intentType,
    title: 'Busca operacional',
    answer:
      'Nao consegui consultar os dados agora. Posso continuar ajudando com navegacao e explicacoes do sistema.',
    cards: [],
    navigationTarget: null,
    suggestions: ['Ajuda sobre pedidos', 'Abrir clientes', 'Nova venda'],
  }
}

function buildUnknownFallback() {
  return {
    intentType: INTENTS.unknown,
    title: 'NEXA',
    answer:
      'Posso ajudar com explicacoes do sistema, navegacao entre modulos e busca segura por pedidos, vendas, clientes e produtos.',
    cards: [],
    navigationTarget: null,
    suggestions: ['Ajuda sobre pedidos', 'Nova venda', 'Buscar cliente'],
  }
}

function buildContextSuggestions(context = {}, cards = []) {
  const suggestions = []

  if (context.orderId) {
    suggestions.push('Buscar pedido', 'Nova venda')
  }

  if (context.saleId) {
    suggestions.push('Vendas de hoje', 'Buscar cliente')
  }

  if (context.routePath === '/products' || context.routePath === '/inventory') {
    suggestions.push('Buscar produto', 'Abrir estoque')
  }

  if (
    context.routePath === '/couriers' ||
    context.routePath === '/schedule' ||
    context.routePath === '/machines' ||
    context.routePath === '/delivery-reading'
  ) {
    suggestions.push('Abrir escala', 'Abrir maquininhas')
  }

  if (cards[0]?.type === 'product') {
    suggestions.push('Abrir estoque', 'Nova venda')
  }

  if (cards[0]?.type === 'customer') {
    suggestions.push('Novo pedido', 'Nova venda')
  }

  return Array.from(new Set([...suggestions, 'Buscar pedido', 'Buscar cliente'])).slice(0, 3)
}

function buildSearchAnswerFallback(cards) {
  return `Encontrei ${cards.length} resultado${cards.length > 1 ? 's' : ''} para voce consultar agora.`
}

function buildSearchSuccessResponse(cards, answer) {
  return {
    intentType: INTENTS.search,
    title: cards[0]?.type
      ? `Busca de ${cards[0].type === 'sale' ? 'vendas' : cards[0].type === 'order' ? 'pedidos' : cards[0].type === 'customer' ? 'clientes' : 'produtos'}`
      : 'Busca operacional',
    answer,
    cards,
    navigationTarget: cards[0]?.route
      ? { route: cards[0].route, label: 'Abrir primeiro resultado' }
      : null,
    suggestions: buildContextSuggestions({}, cards),
  }
}

async function fetchSearchCards({ storeId, intent, message }) {
  if (intent.entity === 'sales' || intent.normalizedText.includes('venda')) {
    return queryService.searchSales({ storeId, text: message })
  }

  if (intent.entity === 'orders' || intent.normalizedText.includes('pedido')) {
    return queryService.searchOrders({ storeId, text: message })
  }

  if (intent.entity === 'customers' || intent.normalizedText.includes('cliente')) {
    return queryService.searchCustomers({ storeId, text: message })
  }

  if (intent.entity === 'products' || intent.normalizedText.includes('produto')) {
    return queryService.searchProducts({ storeId, text: message })
  }

  return queryService.searchSales({ storeId, text: message })
}

async function resolveSearchResponse({ storeId, intent, message, context }) {
  const cards = await fetchSearchCards({ storeId, intent, message })

  if (cards.length === 0) {
    return buildEmptySearchResponse(intent.entity)
  }

  const fallbackAnswer = buildSearchAnswerFallback(cards)

  try {
    const llmAnswer = await queryLLM({ message, context, dataContext: cards })
    return {
      ...buildSearchSuccessResponse(cards, llmAnswer || fallbackAnswer),
      suggestions: buildContextSuggestions(context, cards),
    }
  } catch (_error) {
    return {
      ...buildSearchSuccessResponse(cards, fallbackAnswer),
      suggestions: buildContextSuggestions(context, cards),
    }
  }
}

async function resolveHelpResponse({ intent, message, context }) {
  const helpResponse = resolveKnowledgeAnswer(message, context)

  try {
    const llmAnswer = await queryLLM({ message, context, dataContext: [] })

    return {
      intentType: intent.type,
      title: helpResponse.title,
      answer: llmAnswer || helpResponse.answer,
      cards: [],
      navigationTarget: intent.route
        ? { route: intent.route, label: 'Abrir modulo relacionado' }
        : null,
      suggestions: buildContextSuggestions(context, [])
        .concat(helpResponse.suggestions)
        .slice(0, 3),
    }
  } catch (_error) {
    return {
      intentType: intent.type,
      title: helpResponse.title,
      answer: helpResponse.answer,
      cards: [],
      navigationTarget: intent.route
        ? { route: intent.route, label: 'Abrir modulo relacionado' }
        : null,
      suggestions: buildContextSuggestions(context, [])
        .concat(helpResponse.suggestions)
        .slice(0, 3),
    }
  }
}

export async function handleAssistantQuery({ storeId, message, context = {} }) {
  const intent = resolveAssistantIntent(message)

  if (intent.type === INTENTS.navigation) {
    return buildNavigationResponse(intent)
  }

  if (intent.type === INTENTS.search) {
    try {
      return await resolveSearchResponse({ storeId, intent, message, context })
    } catch (_error) {
      return buildSearchErrorResponse(intent.type)
    }
  }

  if (intent.type === INTENTS.help) {
    return resolveHelpResponse({ intent, message, context })
  }

  const fallbackResponse = buildUnknownFallback()

  try {
    const llmAnswer = await queryLLM({ message, context, dataContext: [] })
    return {
      ...fallbackResponse,
      answer: llmAnswer || fallbackResponse.answer,
    }
  } catch (_error) {
    return fallbackResponse
  }
}
