import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import '../styles/dashboard.css'

import PageIntro from '../components/common/PageIntro'
import DashboardFilters from '../components/dashboard/DashboardFilters'
import DashboardExecutiveHero from '../components/dashboard/DashboardExecutiveHero'
import DashboardKpiGrid from '../components/dashboard/DashboardKpiGrid'
import DashboardOperationalSummary from '../components/dashboard/DashboardOperationalSummary'
import { ErrorDisplay, LoadingOverlay, Skeleton } from '../components/ui'
import { useStore } from '../contexts/StoreContext'
import { getApiErrorDisplayModel } from '../services/apiErrorHandler'
import {
  buildDashboardData,
  getDefaultDashboardPeriod,
  loadDashboardOperationalSources,
  subscribeToDashboardSources,
} from '../services/dashboard'
import { firebaseReady } from '../services/firebaseAuthRuntime'
import { LOCAL_RECORDS_EVENT } from '../services/localAccess'

const DashboardCharts = lazy(() => import('../components/dashboard/DashboardCharts'))
const DashboardAnalytics = lazy(() => import('./Dashboard/DashboardAnalytics'))

function formatDateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function DashboardPage() {
  const navigate = useNavigate()
  const { currentStoreId, availableStoreIds, setCurrentStoreId } = useStore()
  const [isPageVisible, setIsPageVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
  )
  const [period, setPeriod] = useState(() => getDefaultDashboardPeriod())
  const [sales, setSales] = useState([])
  const [orders, setOrders] = useState([])
  const [inventoryItems, setInventoryItems] = useState([])
  const [financialEntries, setFinancialEntries] = useState([])
  const [operationalSources, setOperationalSources] = useState(() =>
    loadDashboardOperationalSources(),
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [errorObject, setErrorObject] = useState(null)
  const [isDashboardLoading, setIsDashboardLoading] = useState(true)
  const [showHeavyPanels, setShowHeavyPanels] = useState(false)

  useEffect(() => {
    function handleVisibilityChange() {
      setIsPageVisible(document.visibilityState !== 'hidden')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    const relevantStorageKeys = new Set([
      'nexus-module-schedule',
      'nexus-module-machine-history',
      'nexus-module-change',
      'nexus-module-advances',
      'nexus-module-occurrences',
      'nexus-manual-couriers',
      'nexus-module-delivery-reading',
      'nexus-module-cash-financial-pending',
      'nexus-module-cash-state',
    ])

    function refreshOperationalSources(event) {
      if (event?.detail?.storageKey && !relevantStorageKeys.has(event.detail.storageKey)) {
        return
      }

      setOperationalSources(loadDashboardOperationalSources())
    }

    refreshOperationalSources()
    window.addEventListener(LOCAL_RECORDS_EVENT, refreshOperationalSources)

    return () => {
      window.removeEventListener(LOCAL_RECORDS_EVENT, refreshOperationalSources)
    }
  }, [])

  useEffect(() => {
    setShowHeavyPanels(false)

    if (isDashboardLoading) {
      return undefined
    }

    const schedule = window.requestIdleCallback ?? ((callback) => window.setTimeout(callback, 180))

    const cancel = window.cancelIdleCallback ?? ((handle) => window.clearTimeout(handle))

    const handle = schedule(() => {
      setShowHeavyPanels(true)
    })

    return () => cancel(handle)
  }, [isDashboardLoading, currentStoreId, period.endDate, period.startDate])

  useEffect(() => {
    if (!firebaseReady || !currentStoreId) {
      setSales([])
      setOrders([])
      setInventoryItems([])
      setFinancialEntries([])
      setIsDashboardLoading(false)
      return undefined
    }

    if (!isPageVisible) {
      return undefined
    }

    setErrorMessage('')
    setErrorObject(null)
    setIsDashboardLoading(true)
    const sourceLoadState = {
      sales: false,
      orders: false,
      inventory: false,
      financial: false,
    }

    function markLoaded(sourceKey) {
      if (sourceLoadState[sourceKey]) {
        return
      }

      sourceLoadState[sourceKey] = true

      if (Object.values(sourceLoadState).every(Boolean)) {
        setIsDashboardLoading(false)
      }
    }

    return subscribeToDashboardSources(
      currentStoreId,
      {
        onSales(nextSales) {
          setSales(nextSales)
          markLoaded('sales')
        },
        onOrders(nextOrders) {
          setOrders(nextOrders)
          markLoaded('orders')
        },
        onInventoryItems(nextInventoryItems) {
          setInventoryItems(nextInventoryItems)
          markLoaded('inventory')
        },
        onFinancialEntries(nextFinancialEntries) {
          setFinancialEntries(nextFinancialEntries)
          markLoaded('financial')
        },
        onError(error) {
          setErrorMessage(error.message ?? 'Nao foi possivel carregar o dashboard operacional.')
          setErrorObject(error)
          setIsDashboardLoading(false)
        },
      },
      {
        startDate: period.startDate,
        endDate: period.endDate,
      },
    )
  }, [currentStoreId, isPageVisible, period.endDate, period.startDate])

  const dashboardErrorModel = errorObject ? getApiErrorDisplayModel(errorObject) : null

  const { kpis, charts, operations } = useMemo(
    () =>
      buildDashboardData({
        storeId: currentStoreId,
        sales,
        orders,
        financialEntries,
        inventoryItems,
        startDate: period.startDate,
        endDate: period.endDate,
        operations: operationalSources,
      }),
    [
      financialEntries,
      inventoryItems,
      currentStoreId,
      operationalSources,
      orders,
      period.endDate,
      period.startDate,
      sales,
    ],
  )

  function handlePeriodChange(field, value) {
    setPeriod((current) => ({
      ...(() => {
        const next = {
          ...current,
          [field]: value,
        }

        if (field === 'startDate' && next.endDate && value > next.endDate) {
          next.endDate = value
        }

        if (field === 'endDate' && next.startDate && value < next.startDate) {
          next.startDate = value
        }

        return next
      })(),
    }))
  }

  function handlePresetChange(preset) {
    const endDate = new Date()
    const startDate = new Date()

    if (preset === 'today') {
      const today = formatDateInputValue(endDate)

      setPeriod({
        startDate: today,
        endDate: today,
      })
      return
    }

    startDate.setDate(endDate.getDate() - (preset === '30d' ? 29 : 6))

    setPeriod({
      startDate: formatDateInputValue(startDate),
      endDate: formatDateInputValue(endDate),
    })
  }

  return (
    <main className="page-stack" aria-labelledby="dashboard-page-title">
      <PageIntro
        eyebrow="Overview"
        title="Dashboard Operacional"
        description="Indicadores, alertas e leitura rapida do turno."
        titleId="dashboard-page-title"
      />

      <section className="dashboard-shell">
        <LoadingOverlay
          active={isDashboardLoading}
          label="Carregando indicadores operacionais"
          backdrop
        >
          Sincronizando indicadores e operacao do dia
        </LoadingOverlay>

        <DashboardFilters
          startDate={period.startDate}
          endDate={period.endDate}
          onChange={handlePeriodChange}
          onSetPreset={handlePresetChange}
        />

        {errorMessage ? (
          <ErrorDisplay
            code={dashboardErrorModel?.code}
            title={dashboardErrorModel?.title ?? 'Falha ao montar o dashboard'}
            message={dashboardErrorModel?.message ?? errorMessage}
            suggestion={
              dashboardErrorModel?.suggestion ??
              'Tente atualizar a pagina ou aguarde a proxima sincronizacao.'
            }
            actionLabel="Tentar novamente"
            onAction={() => window.location.reload()}
          />
        ) : null}

        {operations.reminders?.length ? (
          <section aria-label="Lembretes operacionais">
            {operations.reminders.map((reminder) => (
              <button
                key={reminder.id}
                type="button"
                className={`dashboard-alert dashboard-alert--${reminder.type}`}
                onClick={() => reminder.route && navigate(reminder.route)}
                title={reminder.title}
              >
                <span className="dashboard-alert__dot" aria-hidden="true" />
                <div className="dashboard-alert__copy">
                  <strong>{reminder.title}</strong>
                  <span>{reminder.message}</span>
                </div>
              </button>
            ))}
          </section>
        ) : null}

        {isDashboardLoading ? (
          <section className="workspace-loading-grid" aria-label="Carregando resumo executivo">
            <Skeleton variant="rect" height="220px" />
          </section>
        ) : (
          <DashboardExecutiveHero hero={operations.hero} onNavigate={navigate} />
        )}

        {isDashboardLoading ? (
          <section className="workspace-loading-grid" aria-label="Carregando indicadores">
            <Skeleton variant="rect" height="112px" />
            <Skeleton variant="rect" height="112px" />
            <Skeleton variant="rect" height="112px" />
          </section>
        ) : (
          <DashboardKpiGrid items={kpis} />
        )}
        {showHeavyPanels ? (
          <Suspense
            fallback={
              <div className="workspace-loading-grid">
                <Skeleton variant="rect" height="240px" />
              </div>
            }
          >
            <DashboardCharts charts={charts} />
          </Suspense>
        ) : (
          <div className="workspace-loading-grid" role="status" aria-live="polite">
            <Skeleton variant="rect" height="240px" />
          </div>
        )}
        <DashboardOperationalSummary operations={operations} onNavigate={navigate} />
        {showHeavyPanels ? (
          <Suspense
            fallback={
              <div className="workspace-loading-grid">
                <Skeleton variant="rect" height="280px" />
              </div>
            }
          >
            <DashboardAnalytics
              currentStoreId={currentStoreId}
              availableStoreIds={availableStoreIds}
              onStoreChange={setCurrentStoreId}
            />
          </Suspense>
        ) : (
          <div className="workspace-loading-grid" role="status" aria-live="polite">
            <Skeleton variant="rect" height="280px" />
          </div>
        )}
      </section>
    </main>
  )
}

export default DashboardPage
