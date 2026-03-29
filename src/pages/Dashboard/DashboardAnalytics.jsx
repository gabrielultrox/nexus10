import { useEffect, useMemo, useState } from 'react'

import SurfaceCard from '../../components/common/SurfaceCard'
import ChartPanel from '../../components/dashboard/ChartPanel'
import DashboardSectionHeader from '../../components/dashboard/DashboardSectionHeader'
import MetricsGrid from '../../components/dashboard/MetricsGrid'
import { Button, ErrorDisplay, Select, Skeleton } from '../../components/ui'
import { useToast } from '../../hooks/useToast'
import { getApiErrorDisplayModel } from '../../services/apiErrorHandler'
import { getDashboardAnalytics } from '../../services/analyticsService'

function formatDateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

function getDefaultAnalyticsFilters() {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - 29)

  return {
    startDate: formatDateInputValue(startDate),
    endDate: formatDateInputValue(endDate),
    module: 'all',
    compareBy: 'previous_period',
  }
}

function DashboardAnalytics({ currentStoreId, availableStoreIds = [], onStoreChange }) {
  const toast = useToast()
  const [filters, setFilters] = useState(() => getDefaultAnalyticsFilters())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!currentStoreId) {
      setData(null)
      setLoading(false)
      return undefined
    }

    let active = true
    setLoading(true)
    setError(null)

    getDashboardAnalytics({
      storeId: currentStoreId,
      ...filters,
    })
      .then((response) => {
        if (!active) {
          return
        }

        setData(response)
      })
      .catch((requestError) => {
        if (!active) {
          return
        }

        setError(requestError)
        toast.warning('Falha ao atualizar a leitura analitica.')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [currentStoreId, filters, toast])

  const errorModel = error ? getApiErrorDisplayModel(error) : null
  const presets = useMemo(
    () => [
      { id: '7d', label: '7 dias', offset: 6 },
      { id: '30d', label: '30 dias', offset: 29 },
      { id: '90d', label: '90 dias', offset: 89 },
    ],
    [],
  )

  function handleFilterChange(field, value) {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handlePreset(offset) {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - offset)

    setFilters((current) => ({
      ...current,
      startDate: formatDateInputValue(startDate),
      endDate: formatDateInputValue(endDate),
    }))
  }

  return (
    <section className="dashboard-section" aria-labelledby="dashboard-analytics-title">
      <DashboardSectionHeader
        title="Analitico"
        subtitle="KPIs, comparativos e leitura de negocio por loja e periodo."
      />

      <SurfaceCard title="Filtros analiticos">
        <form
          className="dashboard-analytics-filters"
          aria-label="Filtros analiticos"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="dashboard-analytics-filters__grid">
            <div className="ui-field">
              <label className="ui-label" htmlFor="dashboard-analytics-store">
                Loja
              </label>
              <Select
                id="dashboard-analytics-store"
                value={currentStoreId ?? ''}
                onChange={(event) => onStoreChange?.(event.target.value)}
              >
                {availableStoreIds.map((storeId) => (
                  <option key={storeId} value={storeId}>
                    {storeId}
                  </option>
                ))}
              </Select>
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="dashboard-analytics-start">
                Inicio
              </label>
              <input
                id="dashboard-analytics-start"
                className="ui-input"
                type="date"
                value={filters.startDate}
                onChange={(event) => handleFilterChange('startDate', event.target.value)}
              />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="dashboard-analytics-end">
                Fim
              </label>
              <input
                id="dashboard-analytics-end"
                className="ui-input"
                type="date"
                value={filters.endDate}
                onChange={(event) => handleFilterChange('endDate', event.target.value)}
              />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="dashboard-analytics-module">
                Modulo
              </label>
              <Select
                id="dashboard-analytics-module"
                value={filters.module}
                onChange={(event) => handleFilterChange('module', event.target.value)}
              >
                <option value="all">Todos</option>
                <option value="pdv">PDV</option>
                <option value="ifood">iFood</option>
                <option value="ze_delivery">Ze Delivery</option>
              </Select>
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="dashboard-analytics-compare">
                Comparativo
              </label>
              <Select
                id="dashboard-analytics-compare"
                value={filters.compareBy}
                onChange={(event) => handleFilterChange('compareBy', event.target.value)}
              >
                <option value="previous_period">Periodo anterior</option>
                <option value="week">Semana anterior</option>
                <option value="month">Mes anterior</option>
                <option value="year">Ano anterior</option>
              </Select>
            </div>
          </div>

          <div
            className="dashboard-analytics-filters__actions"
            role="group"
            aria-label="Atalhos de periodo"
          >
            {presets.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant={preset.id === '30d' ? 'secondary' : 'ghost'}
                onClick={() => handlePreset(preset.offset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </form>
      </SurfaceCard>

      {errorModel ? (
        <ErrorDisplay
          code={errorModel.code}
          title={errorModel.title}
          message={errorModel.message}
          suggestion={errorModel.suggestion}
          actionLabel="Tentar novamente"
          onAction={() => setFilters((current) => ({ ...current }))}
        />
      ) : null}

      {loading ? (
        <section className="workspace-loading-grid" aria-label="Carregando analises">
          <Skeleton variant="rect" height="120px" />
          <Skeleton variant="rect" height="120px" />
          <Skeleton variant="rect" height="120px" />
          <Skeleton variant="rect" height="240px" />
        </section>
      ) : null}

      {!loading && data ? (
        <>
          <MetricsGrid items={data.metrics} />

          <div className="dashboard-analytics-grid">
            {data.charts.map((chart) => (
              <ChartPanel key={chart.id} chart={chart} />
            ))}
          </div>

          <div className="dashboard-summary-grid dashboard-summary-grid--analytics">
            <SurfaceCard title="Destaques executivos">
              <div className="ops-list ops-list--compact">
                <div className="ops-row ops-row--inline">
                  <div className="ops-row__main">
                    <strong className="ops-row__title ops-row__title--small">Melhor produto</strong>
                    <span className="ops-row__value">
                      {data.highlights.bestProduct
                        ? `${data.highlights.bestProduct.name} · ${data.highlights.bestProduct.quantity} un.`
                        : 'Sem leitura suficiente'}
                    </span>
                  </div>
                </div>
                <div className="ops-row ops-row--inline">
                  <div className="ops-row__main">
                    <strong className="ops-row__title ops-row__title--small">Menor giro</strong>
                    <span className="ops-row__value">
                      {data.highlights.worstProduct
                        ? `${data.highlights.worstProduct.name} · ${data.highlights.worstProduct.quantity} un.`
                        : 'Sem leitura suficiente'}
                    </span>
                  </div>
                </div>
                <div className="ops-row ops-row--inline">
                  <div className="ops-row__main">
                    <strong className="ops-row__title ops-row__title--small">
                      Entregador lider
                    </strong>
                    <span className="ops-row__value">
                      {data.highlights.strongestCourier
                        ? `${data.highlights.strongestCourier.name} · ${data.highlights.strongestCourier.ordersPerHour}/h`
                        : 'Sem leitura suficiente'}
                    </span>
                  </div>
                </div>
                <div className="ops-row ops-row--inline">
                  <div className="ops-row__main">
                    <strong className="ops-row__title ops-row__title--small">Anomalias</strong>
                    <span className="ops-row__value">
                      {data.highlights.anomalies.length > 0
                        ? `${data.highlights.anomalies.length} dia(s) fora da curva`
                        : 'Nenhuma anomalia critica'}
                    </span>
                  </div>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard title="Alertas e leitura">
              <div className="ops-list">
                {data.alerts.map((alert) => (
                  <article
                    key={alert.id}
                    className={`ops-row ops-row--risk ops-row--risk-${alert.tone}`}
                  >
                    <div className="ops-row__stack">
                      <strong className="ops-row__title">{alert.title}</strong>
                      <p className="ops-row__meta">{alert.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard title="Resumo tecnico">
              <div className="ops-metrics ops-metrics--grid">
                <article className="ops-metric">
                  <span className="ops-metric__label">Registros lidos</span>
                  <strong className="ops-metric__value">
                    {data.metadata.records.sales + data.metadata.records.orders}
                  </strong>
                  <p className="ops-metric__meta">
                    {data.metadata.records.sales} vendas · {data.metadata.records.orders} pedidos
                  </p>
                </article>
                <article className="ops-metric">
                  <span className="ops-metric__label">Cache / calculo</span>
                  <strong className="ops-metric__value">{data.cacheTtlSeconds / 60} min</strong>
                  <p className="ops-metric__meta">{data.metadata.targetSource}</p>
                </article>
                <article className="ops-metric">
                  <span className="ops-metric__label">Latencia do filtro</span>
                  <strong className="ops-metric__value">{data.metadata.filterLatencyMs} ms</strong>
                  <p className="ops-metric__meta">Calculo entregue pelo backend</p>
                </article>
                <article className="ops-metric">
                  <span className="ops-metric__label">Comparativo</span>
                  <strong className="ops-metric__value">
                    {data.comparisons.previous.startDate}
                  </strong>
                  <p className="ops-metric__meta">ate {data.comparisons.previous.endDate}</p>
                </article>
              </div>
            </SurfaceCard>
          </div>
        </>
      ) : null}
    </section>
  )
}

export default DashboardAnalytics
