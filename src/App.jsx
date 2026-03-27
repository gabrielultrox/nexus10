import { useEffect, useRef, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'

import AppErrorBoundary from './components/system/AppErrorBoundary'
import SystemBoot from './components/system/SystemBoot'
import { ensureFrontendEnvLoaded } from './config/env'
import { useAuth, useConfirm, useStore, useToast } from './hooks'
import AppRoutes from './routes'
import { loadResettableLocalRecords } from './services/localAccess'
import {
  bindGlobalSoundEffects,
  playNavigation,
  playWarning,
  unbindGlobalSoundEffects,
} from './services/soundManager'
import { queryClient } from './services/queryClient'

ensureFrontendEnvLoaded()

const FINANCIAL_PENDING_STORAGE_KEY = 'nexus-module-cash-financial-pending'
const CASH_RESET_HOUR = 3
const FINANCIAL_PENDING_REMINDER_KEY = 'nexus10.financialPendingReminder'

function getOperationalDay(resetHour = 3) {
  const now = new Date()
  const operationalDate = new Date(now)

  if (now.getHours() < resetHour) {
    operationalDate.setDate(operationalDate.getDate() - 1)
  }

  const year = operationalDate.getFullYear()
  const month = String(operationalDate.getMonth() + 1).padStart(2, '0')
  const day = String(operationalDate.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, loading } = useAuth()
  const { currentStoreId } = useStore()
  const confirm = useConfirm()
  const toast = useToast()
  const [bootSequenceComplete, setBootSequenceComplete] = useState(false)
  const lastPathRef = useRef(location.pathname)
  const bootVisible = !bootSequenceComplete || loading

  useEffect(() => {
    const rootElement = document.documentElement
    rootElement.classList.toggle('app-booting', bootVisible)

    return () => {
      rootElement.classList.remove('app-booting')
    }
  }, [bootVisible])

  useEffect(() => {
    bindGlobalSoundEffects()
    return () => {
      unbindGlobalSoundEffects()
    }
  }, [])

  useEffect(() => {
    if (bootVisible) {
      lastPathRef.current = location.pathname
      return
    }

    if (lastPathRef.current !== location.pathname) {
      playNavigation()
      lastPathRef.current = location.pathname
    }
  }, [bootVisible, location.pathname])

  useEffect(() => {
    if (!bootSequenceComplete || loading) {
      return
    }

    if (!isAuthenticated && location.pathname !== '/login') {
      navigate('/login', {
        replace: true,
        state: {
          from: {
            pathname: location.pathname,
          },
        },
      })
      return
    }

    if (isAuthenticated && location.pathname === '/login') {
      const nextPath = location.state?.from?.pathname

      navigate(nextPath && nextPath !== '/login' ? nextPath : '/dashboard', {
        replace: true,
      })
    }
  }, [bootSequenceComplete, isAuthenticated, loading, location.pathname, location.state, navigate])

  useEffect(() => {
    async function remindFinancialPendings() {
      if (!bootSequenceComplete || loading || !isAuthenticated || !currentStoreId) {
        return
      }

      const operationalDay = getOperationalDay(CASH_RESET_HOUR)
      const reminderKey = `${FINANCIAL_PENDING_REMINDER_KEY}:${currentStoreId}:${operationalDay}`

      if (window.localStorage.getItem(reminderKey)) {
        return
      }

      const records = loadResettableLocalRecords(FINANCIAL_PENDING_STORAGE_KEY, [], CASH_RESET_HOUR)
      const openRecords = records.filter((record) => !record?.resolvedAtClient)

      if (openRecords.length === 0) {
        window.localStorage.setItem(reminderKey, 'seen')
        return
      }

      const matrixCount = openRecords.filter(
        (record) => (record?.channel ?? 'matrix') === 'matrix',
      ).length
      const deliveryCount = openRecords.filter(
        (record) => (record?.channel ?? 'matrix') === 'delivery',
      ).length

      window.localStorage.setItem(reminderKey, 'seen')
      playWarning()

      const shouldOpen = await confirm.ask({
        title: 'Pendencias financeiras abertas',
        message: `${openRecords.length} pendencia(s) aberta(s) neste dia. Matriz: ${matrixCount} | Delivery: ${deliveryCount}. Deseja abrir a fila agora?`,
        confirmLabel: 'Abrir pendencias',
        cancelLabel: 'Depois',
        tone: 'warning',
      })

      if (shouldOpen) {
        navigate('/financial-pendings')
        return
      }

      toast.warning('Pendencias financeiras abertas para acompanhamento do dia.', {
        duration: 4500,
      })
    }

    remindFinancialPendings()
  }, [bootSequenceComplete, confirm, currentStoreId, isAuthenticated, loading, navigate, toast])

  function handleBootComplete() {
    setBootSequenceComplete(true)
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary
        resetKey={location.pathname}
        onReset={() => {
          if (location.pathname !== '/dashboard' && isAuthenticated) {
            navigate('/dashboard', { replace: true })
          }
        }}
      >
        <AppRoutes />
      </AppErrorBoundary>
      {bootVisible ? <SystemBoot onComplete={handleBootComplete} /> : null}
    </QueryClientProvider>
  )
}

export default App
