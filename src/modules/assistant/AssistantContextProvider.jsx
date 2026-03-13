import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useStore } from '../../contexts/StoreContext';
import { queryAssistant } from '../../services/assistant';
import { getRouteByPathname } from '../../utils/routeCatalog';

const AssistantContext = createContext(null);

const initialQuickActions = [
  { id: 'new-order', label: 'Novo pedido', prompt: 'novo pedido', route: '/orders/new', kind: 'navigation' },
  { id: 'new-sale', label: 'Nova venda', prompt: 'nova venda', route: '/sales/new', kind: 'navigation' },
  { id: 'search-order', label: 'Buscar pedido', prompt: 'buscar pedido', kind: 'query' },
  { id: 'search-customer', label: 'Buscar cliente', prompt: 'buscar cliente', kind: 'query' },
  { id: 'sales-today', label: 'Vendas de hoje', prompt: 'mostrar vendas de hoje', kind: 'query' },
  { id: 'orders-help', label: 'Ajuda sobre pedidos', prompt: 'qual a diferenca entre pedido e venda', kind: 'query' },
];

function buildPageContext(pathname) {
  const route = getRouteByPathname(pathname);
  const orderMatch = pathname.match(/^\/orders\/([^/]+)/);
  const saleMatch = pathname.match(/^\/sales\/([^/]+)/);

  return {
    pathname,
    routePath: route.path,
    routeTitle: route.title,
    routeLabel: route.label,
    orderId: orderMatch?.[1] ?? null,
    saleId: saleMatch?.[1] ?? null,
  };
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
  };
}

function buildUserMessage(content) {
  return {
    id: `user-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    role: 'user',
    content,
  };
}

const initialMessages = [
  {
    id: 'assistant-welcome',
    role: 'assistant',
    title: 'NEXA',
    content: 'Pergunte sobre módulos, fluxos operacionais ou busque dados de pedidos, vendas, clientes e produtos.',
    cards: [],
    navigationTarget: null,
    suggestions: ['Novo pedido', 'Nova venda', 'Buscar pedido'],
    intentType: 'WELCOME',
  },
];

export function AssistantContextProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentStoreId } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [isLoading, setIsLoading] = useState(false);

  const pageContext = useMemo(() => buildPageContext(location.pathname), [location.pathname]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length === 0) {
        return initialMessages;
      }

      return current;
    });
  }, [pageContext.pathname]);

  async function sendMessage(message) {
    const trimmedMessage = String(message ?? '').trim();

    if (!trimmedMessage || isLoading) {
      return;
    }

    setMessages((current) => [...current, buildUserMessage(trimmedMessage)]);
    setIsLoading(true);

    try {
      const response = await queryAssistant({
        storeId: currentStoreId,
        message: trimmedMessage,
        context: pageContext,
      });

      setMessages((current) => [...current, buildAssistantMessage(response)]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          title: 'NEXA',
          content: error.message ?? 'Não consegui responder agora.',
          cards: [],
          navigationTarget: null,
          suggestions: ['Ajuda sobre pedidos', 'Nova venda'],
          intentType: 'ERROR',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function openPanel() {
    setIsOpen(true);
  }

  function closePanel() {
    setIsOpen(false);
  }

  function handleQuickAction(action) {
    openPanel();

    if (action.kind === 'navigation' && action.route) {
      navigate(action.route);
      setMessages((current) => [
        ...current,
        buildAssistantMessage({
          title: 'Navegação assistida',
          answer: `Abrindo ${action.label.toLowerCase()} para você.`,
          cards: [],
          navigationTarget: { route: action.route, label: action.label },
          suggestions: ['Buscar pedido', 'Vendas de hoje'],
          intentType: 'NAVIGATION_INTENT',
        }),
      ]);
      return;
    }

    sendMessage(action.prompt);
  }

  const value = {
    isOpen,
    isLoading,
    messages,
    pageContext,
    quickActions: initialQuickActions,
    openPanel,
    closePanel,
    sendMessage,
    handleQuickAction,
    navigateTo(route) {
      navigate(route);
    },
  };

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const context = useContext(AssistantContext);

  if (!context) {
    throw new Error('useAssistant must be used within AssistantContextProvider');
  }

  return context;
}
