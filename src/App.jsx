import { useEffect, useRef, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';

import AppErrorBoundary from './components/system/AppErrorBoundary';
import SystemBoot from './components/system/SystemBoot';
import { useAuth } from './contexts/AuthContext';
import AppRoutes from './routes';
import {
  bindGlobalSoundEffects,
  playNavigation,
  unbindGlobalSoundEffects,
} from './services/soundManager';
import { queryClient } from './services/queryClient';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const [bootSequenceComplete, setBootSequenceComplete] = useState(false);
  const lastPathRef = useRef(location.pathname);
  const bootVisible = !bootSequenceComplete || loading;

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

  useEffect(() => {
    if (!bootSequenceComplete || loading) {
      return;
    }

    if (!isAuthenticated && location.pathname !== '/login') {
      navigate('/login', {
        replace: true,
        state: {
          from: {
            pathname: location.pathname,
          },
        },
      });
      return;
    }

    if (isAuthenticated && location.pathname === '/login') {
      const nextPath = location.state?.from?.pathname;

      navigate(nextPath && nextPath !== '/login' ? nextPath : '/dashboard', {
        replace: true,
      });
    }
  }, [bootSequenceComplete, isAuthenticated, loading, location.pathname, location.state, navigate]);

  function handleBootComplete() {
    setBootSequenceComplete(true);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary
        resetKey={location.pathname}
        onReset={() => {
          if (location.pathname !== '/dashboard' && isAuthenticated) {
            navigate('/dashboard', { replace: true });
          }
        }}
      >
        <AppRoutes />
      </AppErrorBoundary>
      {bootVisible ? <SystemBoot onComplete={handleBootComplete} /> : null}
    </QueryClientProvider>
  );
}

export default App;
