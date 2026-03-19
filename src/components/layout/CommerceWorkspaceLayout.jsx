import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

import AssistantPanel from '../../modules/assistant/AssistantPanel';
import { AssistantContextProvider } from '../../modules/assistant/AssistantContextProvider';

function CommerceWorkspaceLayout() {
  const location = useLocation();
  const navigate = useNavigate();
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
          <div className="commerce-shell__header-inner">
            <div className="commerce-shell__breadcrumb" aria-label="Navegacao do PDV">
              <span className="commerce-shell__breadcrumb-root">PDV</span>
              <span className="commerce-shell__breadcrumb-separator">{'>'}</span>
              <strong className="commerce-shell__breadcrumb-current">
                {isOrdersRoute ? 'Pedidos' : 'Vendas'}
              </strong>
            </div>

            <div className="commerce-shell__header-actions">
              {commerceTabs.map((tab) => {
                const isActive = tab.id === activeTab;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={[
                      'commerce-shell__tab',
                      isActive ? 'commerce-shell__tab--active' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => navigate(tab.id === 'orders' ? '/orders' : '/sales')}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
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
