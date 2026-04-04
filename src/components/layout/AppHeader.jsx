import { useLocation } from 'react-router-dom'

import { useAuth } from '../../contexts/AuthContext'
import { useNotificationLiveStatus } from '../../contexts/NotificationsContext'
import { getRouteByPathname } from '../../utils/routeCatalog'
import NotificationCenter from '../notifications/NotificationCenter'
import ThemeToggle from '../theme/ThemeToggle'

function AppHeader() {
  const location = useLocation()
  const { session, signOut } = useAuth()
  const { connectionStatus } = useNotificationLiveStatus()
  const route = getRouteByPathname(location.pathname)
  const operatorLabel = session?.operatorName ?? session?.displayName ?? 'Operador local'
  const liveStatusLabel =
    connectionStatus === 'connected'
      ? 'Eventos em tempo real'
      : connectionStatus === 'reconnecting'
        ? 'Reconectando eventos'
        : 'Modo degradado'

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__context">
          <span className="app-header__breadcrumb">
            {route.section ?? 'Sistema'}
            <span className="app-header__breadcrumb-separator">/</span>
            <strong className="app-header__context-copy">{route.title}</strong>
          </span>
        </div>

        <div className="app-header__actions">
          <div className="app-header__status">
            <span className="status-dot" />
            <span className="app-header__status-label">{liveStatusLabel}</span>
          </div>
          <span className="ui-badge ui-badge--info">{session?.role ?? 'operador'}</span>
          <span className="app-header__user">{operatorLabel}</span>
          <NotificationCenter />
          <button type="button" className="ui-button ui-button--ghost" onClick={signOut}>
            Sair
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

export default AppHeader
