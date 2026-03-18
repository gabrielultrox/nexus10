import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import AssistantPanel from '../../modules/assistant/AssistantPanel';
import { AssistantContextProvider } from '../../modules/assistant/AssistantContextProvider';
import PageTabs from '../common/PageTabs';
import ThemeToggle from '../theme/ThemeToggle';

function CommerceWorkspaceLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const operatorLabel = session?.operatorName ?? session?.displayName ?? 'Operador local';
  const isOrdersRoute = location.pathname.startsWith('/orders');
  const activeTab = isOrdersRoute ? 'orders' : 'sales';
  const commerceTabs = [
    { id: 'orders', label: 'Pedidos' },
    { id: 'sales', label: 'Vendas' },
  ];

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <AssistantContextProvider>
      <div className="commerce-shell">
        <div className="commerce-shell__backdrop" />

        <header className="commerce-shell__header">
          <div className="commerce-shell__header-copy">
            <p className="commerce-shell__eyebrow">PDV</p>
            <h1 className="commerce-shell__title">{isOrdersRoute ? 'Pedidos' : 'Vendas'}</h1>
          </div>

          <div className="commerce-shell__header-actions">
            <PageTabs
              tabs={commerceTabs}
              activeTab={activeTab}
              onTabChange={(tabId) => navigate(tabId === 'orders' ? '/orders' : '/sales')}
            />
            <div className="commerce-shell__status">
              <span className="status-dot" />
              <strong>{operatorLabel}</strong>
            </div>

            <span className="ui-badge ui-badge--info">{session?.role ?? 'operador'}</span>
            <ThemeToggle />
            <button type="button" className="ui-button ui-button--ghost" onClick={signOut}>
              Sair
            </button>
          </div>
        </header>

        <main className="commerce-shell__content">
          <div className="commerce-shell__content-inner">
            <Outlet />
          </div>
        </main>
        <AssistantPanel />
      </div>
    </AssistantContextProvider>
  );
}

export default CommerceWorkspaceLayout;
