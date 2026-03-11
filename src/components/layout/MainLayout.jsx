import { Outlet } from 'react-router-dom';

import AppHeader from './AppHeader';
import Sidebar from './Sidebar';

function MainLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <AppHeader />
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
