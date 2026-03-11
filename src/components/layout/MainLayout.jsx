import { Outlet } from 'react-router-dom';

import AppHeader from './AppHeader';
import Sidebar from './Sidebar';

function MainLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <div className="app-shell__frame">
          <AppHeader />
          <main className="app-shell__content">
            <div className="app-shell__content-inner">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default MainLayout;
