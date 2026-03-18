import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../contexts/StoreContext';
import AssistantPanel from '../../modules/assistant/AssistantPanel';
import { AssistantContextProvider } from '../../modules/assistant/AssistantContextProvider';
import { getRouteByPathname } from '../../utils/routeCatalog';
import ThemeToggle from '../theme/ThemeToggle';

function CommerceWorkspaceLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const { currentStoreId } = useStore();
  const route = getRouteByPathname(location.pathname);
  const operatorLabel = session?.operatorName ?? session?.displayName ?? 'Operador local';
  const isOrdersRoute = location.pathname.startsWith('/orders');
  const isSalesRoute = location.pathname.startsWith('/sales');

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <AssistantContextProvider>
      <div className="commerce-shell">
        <div className="commerce-shell__backdrop" />

        <header className="commerce-shell__header">
          <div className="commerce-shell__header-copy">
            <p className="commerce-shell__eyebrow">{route.eyebrow}</p>
            <h1 className="commerce-shell__title">{route.title}</h1>
            <p className="commerce-shell__description">{route.description}</p>
          </div>

          <div className="commerce-shell__header-actions">
            <div className="commerce-shell__status">
              <span className="status-dot" />
              <div>
                <strong>{operatorLabel}</strong>
                <small>{currentStoreId ? `store ${currentStoreId}` : 'sessao local'}</small>
              </div>
            </div>

            <span className="ui-badge ui-badge--info">{session?.role ?? 'operador'}</span>
            <ThemeToggle />
            <button type="button" className="ui-button ui-button--ghost" onClick={signOut}>
              Sair
            </button>
          </div>
        </header>

        <section className="commerce-shell__rail">
          <div className="commerce-shell__rail-copy">
            <span className="commerce-shell__rail-kicker">Workspace</span>
            <strong>Fluxo comercial dedicado</strong>
          </div>

          <div className="commerce-shell__rail-actions">
            <button type="button" className="ui-button ui-button--ghost" onClick={() => navigate('/dashboard')}>
              Voltar ao painel
            </button>
            <button
              type="button"
              className={`ui-button ${isOrdersRoute ? 'ui-button--secondary' : 'ui-button--ghost'}`}
              onClick={() => navigate('/orders')}
            >
              Pedidos
            </button>
            <button
              type="button"
              className={`ui-button ${isSalesRoute ? 'ui-button--secondary' : 'ui-button--ghost'}`}
              onClick={() => navigate('/sales')}
            >
              Vendas
            </button>
          </div>
        </section>

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
