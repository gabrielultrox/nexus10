import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationsProvider } from './contexts/NotificationsContext'
import { StoreProvider } from './contexts/StoreContext'
import { ConfirmProvider } from './hooks/useConfirm'
import { ToastProvider } from './hooks/useToast'
import { ThemeProvider } from './hooks/useTheme'
import { registerPwa } from './services/pwa'
import { setupRuntimeRecovery } from './services/runtimeRecovery'
import { initializeSoundManager } from './services/soundManager'
import './styles/reset.css'
import './styles/tokens.css'
import './styles/typography.css'
import './styles/transitions.css'
import './styles/components.css'
import './styles/global.css'
import './styles/auth.css'
import './styles/pwa.css'
import './styles/settings.css'
import './styles/dashboard.css'
import './styles/orders.css'
import './styles/finance.css'
import './styles/cash.css'
import './styles/couriers.css'
import './styles/native-modules.css'
import './styles/system-boot.css'
import './styles/entity-modules.css'
import './styles/sales.css'
import './styles/reports.css'
import './styles/shortcuts.css'
import './styles/inventory.css'
import './styles/audit-log.css'
import './styles/history.css'

function scheduleNonCriticalStartup(work) {
  if (typeof window === 'undefined') {
    work()
    return
  }

  const run = () => {
    window.setTimeout(work, 0)
  }

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 1200 })
    return
  }

  if (document.readyState === 'complete') {
    run()
    return
  }

  window.addEventListener('load', run, { once: true })
}

scheduleNonCriticalStartup(() => {
  registerPwa()
  setupRuntimeRecovery()
  initializeSoundManager()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <StoreProvider>
            <ToastProvider>
              <NotificationsProvider>
                <ConfirmProvider>
                  <App />
                </ConfirmProvider>
              </NotificationsProvider>
            </ToastProvider>
          </StoreProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
