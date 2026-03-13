import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useStore } from '../../contexts/StoreContext'
import { queryAssistant } from '../../services/assistant'
import { getRouteByPathname } from '../../utils/routeCatalog'

const AssistantContext = createContext(null)

const defaultQuickActions = [
  { id: 'new-order', label: 'Novo pedido', prompt: 'novo pedido', route: '/orders/new', kind: 'navigation' },
  { id: 'new-sale', label: 'Nova venda', prompt: 'nova venda', route: '/sales/new', kind: 'navigation' },
  { id: 'search-order', label: 'Buscar pedido', prompt: 'buscar pedido', kind: 'query' },
  { id: 'search-customer', label: 'Buscar cliente', prompt: 'buscar cliente', kind: 'query' },
  { id: 'sales-today', label: 'Vendas de hoje', prompt: 'mostrar vendas de hoje', kind: 'query' },
  { id: 'orders-help', label: 'Ajuda sobre pedidos', prompt: 'qual a diferenca entre pedido e venda', kind: 'query' },
]

function getQuickActionsForPath(pathname) {
  if (pathname.startsWith('/orders')) {
    return [
      { id: 'orders-list', label: 'Lista de pedidos', prompt: 'abrir pedidos', route: '/orders', kind: 'navigation' },
      { id: 'new-order', label: 'Novo pedido', prompt: 'novo pedido', route: '/orders/new', kind: 'navigation' },
      { id: 'search-order', label: 'Buscar pedido', prompt: 'buscar pedido', kind: 'query' },
      { id: 'orders-help', label: 'Ajuda sobre pedidos', prompt: 'qual a diferenca entre pedido e venda', kind: 'query' },
      { id: 'sales-today', label: 'Vendas de hoje', prompt: 'mostrar vendas de hoje', kind: 'query' },
    ]
  }

  if (pathname.startsWith('/sales')) {
    return [
      { id: 'sales-list', label: 'Lista de vendas', prompt: 'abrir vendas', route: '/sales', kind: 'navigation' },
      { id: 'new-sale', label: 'Nova venda', prompt: 'nova venda', route: '/sales/new', kind: 'navigation' },
      { id: 'search-customer', label: 'Buscar cliente', prompt: 'buscar cliente', kind: 'query' },
      { id: 'sales-today', label: 'Vendas de hoje', prompt: 'mostrar vendas de hoje', kind: 'query' },
      { id: 'sales-help', label: 'Ajuda sobre vendas', prompt: 'como gerar uma venda', kind: 'query' },
    ]
  }

  if (pathname.startsWith('/customers')) {
    return [
      { id: 'open-customers', label: 'Abrir clientes', prompt: 'abrir clientes', route: '/customers', kind: 'navigation' },
      { id: 'new-order', label: 'Novo pedido', prompt: 'novo pedido', route: '/orders/new', kind: 'navigation' },
      { id: 'search-customer', label: 'Buscar cliente', prompt: 'buscar cliente', kind: 'query' },
      { id: 'customer-help', label: 'Ajuda sobre clientes', prompt: 'como cadastrar cliente', kind: 'query' },
    ]
  }

  if (pathname.startsWith('/products') || pathname.startsWith('/inventory')) {
    return [
      { id: 'open-products', label: 'Abrir produtos', prompt: 'abrir produtos', route: '/products', kind: 'navigation' },
      { id: 'open-inventory', label: 'Abrir estoque', prompt: 'abrir estoque', route: '/inventory', kind: 'navigation' },
      { id: 'search-product', label: 'Buscar produto', prompt: 'buscar produto', kind: 'query' },
      { id: 'sales-today', label: 'Vendas de hoje', prompt: 'mostrar vendas de hoje', kind: 'query' },
    ]
  }

  if (
    pathname.startsWith('/couriers')
    || pathname.startsWith('/schedule')
    || pathname.startsWith('/machines')
    || pathname.startsWith('/delivery-reading')
  ) {
    return [
      { id: 'open-couriers', label: 'Abrir entregadores', prompt: 'abrir entregadores', route: '/couriers/consulta', kind: 'navigation' },
      { id: 'open-schedule', label: 'Abrir escala', prompt: 'abrir escala', route: '/schedule', kind: 'navigation' },
      { id: 'open-machines', label: 'Abrir maquininhas', prompt: 'abrir maquininhas', route: '/machines', kind: 'navigation' },
      { id: 'operational-help', label: 'Ajuda operacional', prompt: 'como funciona a escala', kind: 'query' },
    ]
  }

  return defaultQuickActions
}

function buildPageContext(pathname) {
  const route = getRouteByPathname(pathname)
  const orderMatch = pathname.match(/^\/orders\/([^/]+)/)
  const saleMatch = pathname.match(/^\/sales\/([^/]+)/)

  return {
    pathname,
    routePath: route.path,
    routeTitle: route.title,
    routeLabel: route.label,
    routeSection: route.section,
    routeEyebrow: route.eyebrow,
    orderId: orderMatch?.[1] ?? null,
    saleId: saleMatch?.[1] ?? null,
  }
}

function buildAssistantMessage(response) {
  return {
    id: `assistant-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    role: 'assistant',
    title: response.title ?? 'NEXA',
    content: response.answer ?? '',
    cards: response.cards ?? [],
    navigationTarget: response.navigationTarget ?? null,
    suggestions: response.suggestions ?? [],
    intentType: response.intentType ?? 'UNKNOWN_INTENT',
  }
}

function buildUserMessage(content) {
  return {
    id: `user-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    role: 'user',
    content,
  }
}

const initialMessages = [
  {
    id: 'assistant-welcome',
    role: 'assistant',
    title: 'NEXA',
    content: 'Pergunte sobre modulos, fluxos operacionais ou busque dados de pedidos, vendas, clientes e produtos.',
    cards: [],
    navigationTarget: null,
    suggestions: ['Novo pedido', 'Nova venda', 'Buscar pedido'],
    intentType: 'WELCOME',
  },
]

export function AssistantContextProvider({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentStoreId } = useStore()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState(initialMessages)
  const [isLoading, setIsLoading] = useState(false)

  const pageContext = useMemo(() => buildPageContext(location.pathname), [location.pathname])
  const quickActions = useMemo(() => getQuickActionsForPath(location.pathname), [location.pathname])

  useEffect(() => {
    setMessages((current) => {
      if (current.length === 0) {
        return initialMessages
      }

      return current
    })
  }, [pageContext.pathname])

  async function sendMessage(message) {
    const trimmedMessage = String(message ?? '').trim()

    if (!trimmedMessage || isLoading) {
      return
    }

    setMessages((current) => [...current, buildUserMessage(trimmedMessage)])
    setIsLoading(true)

    try {
      const response = await queryAssistant({
        storeId: currentStoreId,
        message: trimmedMessage,
        context: pageContext,
      })

      setMessages((current) => [...current, buildAssistantMessage(response)])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          title: 'NEXA',
          content: error.message ?? 'Nao consegui responder agora.',
          cards: [],
          navigationTarget: null,
          suggestions: ['Ajuda sobre pedidos', 'Nova venda'],
          intentType: 'ERROR',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  function openPanel() {
    setIsOpen(true)
  }

  function closePanel() {
    setIsOpen(false)
  }

  function handleQuickAction(action) {
    openPanel()

    if (action.kind === 'navigation' && action.route) {
      navigate(action.route)
      setMessages((current) => [
        ...current,
        buildAssistantMessage({
          title: 'Navegacao assistida',
          answer: `Abrindo ${action.label.toLowerCase()} para voce.`,
          cards: [],
          navigationTarget: { route: action.route, label: action.label },
          suggestions: ['Buscar pedido', 'Vendas de hoje'],
          intentType: 'NAVIGATION_INTENT',
        }),
      ])
      return
    }

    sendMessage(action.prompt)
  }

  const value = {
    isOpen,
    isLoading,
    messages,
    pageContext,
    quickActions,
    openPanel,
    closePanel,
    sendMessage,
    handleQuickAction,
    navigateTo(route) {
      navigate(route)
    },
  }

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  )
}

export function useAssistant() {
  const context = useContext(AssistantContext)

  if (!context) {
    throw new Error('useAssistant must be used within AssistantContextProvider')
  }

  return context
}
