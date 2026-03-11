import { NavLink } from 'react-router-dom';

import { navigationItems } from '../../utils/navigation';

function Sidebar() {
  const sections = navigationItems.reduce((groups, item) => {
    if (!groups[item.section]) {
      groups[item.section] = [];
    }

    groups[item.section].push(item);
    return groups;
  }, {});

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-badge">
          <span className="sidebar__brand-badge-ring" />
          <div className="sidebar__logo">
            <img src="/brand-bolt-red.svg" alt="" className="sidebar__logo-mark" />
          </div>
        </div>
        <div>
          <strong className="sidebar__title">Nexus-10</strong>
          <p className="sidebar__subtitle">Delivery OS // Cyberpunk rebuild</p>
        </div>
      </div>

      <div className="sidebar__status-panel">
        <span className="sidebar__status-line">SYS://DVN-MG-01</span>
        <strong className="sidebar__status-title">Operacao pronta</strong>
        <p className="sidebar__status-copy">Radar local ativo, fila operacional sincronizada e navegacao armada.</p>
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
                  <span className="sidebar__icon">{item.icon}</span>
                  <span className="sidebar__link-copy">
                    <strong>{item.label}</strong>
                    <small>{item.path.replace('/', '').toUpperCase()}</small>
                  </span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <span className="sidebar__footer-line" />
        <p>NEXUS-10 v2 // React shell</p>
      </div>
    </aside>
  );
}

export default Sidebar;
