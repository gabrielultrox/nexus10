import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import SystemBoot from './components/system/SystemBoot';
import { useAuth } from './contexts/AuthContext';
import AppRoutes from './routes';
import {
  bindGlobalSoundEffects,
  playNavigation,
  unbindGlobalSoundEffects,
} from './services/soundManager';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, signOut } = useAuth();
  const [bootVisible, setBootVisible] = useState(true);
  const lastPathRef = useRef(location.pathname);

  useEffect(() => {
    const rootElement = document.documentElement;
    rootElement.classList.toggle('app-booting', bootVisible);

    return () => {
      rootElement.classList.remove('app-booting');
    };
  }, [bootVisible]);

  useEffect(() => {
    bindGlobalSoundEffects();
    return () => {
      unbindGlobalSoundEffects();
    };
  }, []);

  useEffect(() => {
    if (bootVisible) {
      lastPathRef.current = location.pathname;
      return;
    }

    if (lastPathRef.current !== location.pathname) {
      playNavigation();
      lastPathRef.current = location.pathname;
    }
  }, [bootVisible, location.pathname]);

  async function handleBootComplete() {
    if (isAuthenticated) {
      await signOut();
    }

    setBootVisible(false);

    if (location.pathname !== '/login') {
      navigate('/login', {
        replace: true,
        state: {
          from: {
            pathname: location.pathname,
          },
        },
      });
    }
  }

  return (
    <>
      <AppRoutes />
      {bootVisible ? <SystemBoot onComplete={handleBootComplete} /> : null}
    </>
  );
}

export default App;
