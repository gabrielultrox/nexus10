import { NavLink } from 'react-router-dom'

import { useNotifications } from '../../contexts/NotificationsContext'
import { navigationItems } from '../../utils/navigation'

function Sidebar() {
  const { unreadCount } = useNotifications()
  const sections = navigationItems.reduce((groups, item) => {
    if (!groups[item.section]) {
      groups[item.section] = []
    }

    groups[item.section].push(item)
    return groups
  }, {})

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img src="/brand-bolt-red.svg" alt="" className="sidebar__logo-mark" />
        <strong className="sidebar__title">NEXUS</strong>
        {unreadCount > 0 ? <span className="sidebar__badge">{unreadCount}</span> : null}
      </div>

      <nav className="sidebar__nav" aria-label="Navegacao principal">
        {Object.entries(sections).map(([section, items]) => (
          <div key={section} className="sidebar__section">
            <p className="sidebar__section-title">{section}</p>
            <div className="sidebar__section-links">
              {items.map((item) => (
                <NavLink
                  key={item.path}
                  to={`/${item.path}`}
                  className={({ isActive }) =>
                    `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
                  }
                >
                  <strong className="sidebar__link-label">{item.label}</strong>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
