import { useLocation } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { getRouteByPathname } from '../../utils/routeCatalog';
import NotificationCenter from '../notifications/NotificationCenter';
import ThemeToggle from '../theme/ThemeToggle';

function AppHeader() {
  const location = useLocation();
  const { session, signOut } = useAuth();
  const route = getRouteByPathname(location.pathname);
  const operatorLabel = session?.operatorName ?? session?.displayName ?? 'Operador local';

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__context">
          <span className="app-header__context-kicker">{route.eyebrow ?? route.section ?? 'Sistema'}</span>
          <strong className="app-header__context-copy">{route.title}</strong>
        </div>

        <div className="app-header__actions">
          <div className="app-header__status">
            <span className="status-dot" />
            <strong>{operatorLabel}</strong>
          </div>
          <span className="ui-badge ui-badge--info">{session?.role ?? 'operador'}</span>
          <NotificationCenter />
          <button type="button" className="ui-button ui-button--ghost" onClick={signOut}>
            Sair
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
