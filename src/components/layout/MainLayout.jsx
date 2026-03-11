import { Outlet } from 'react-router-dom';

import AssistantPanel from '../../modules/assistant/AssistantPanel';
import { AssistantContextProvider } from '../../modules/assistant/AssistantContextProvider';
import AppHeader from './AppHeader';
import Sidebar from './Sidebar';

function MainLayout() {
  return (
    <AssistantContextProvider>
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
        <AssistantPanel />
      </div>
    </AssistantContextProvider>
  );
}

export default MainLayout;
