import { Button, MetricCard, Toggle } from '../ui'
import type {
  IZeDeliveryStats24h,
  IZeDeliveryStoreSettings,
} from '../../services/zeDeliveryIntegration'

interface IZeDeliveryStatusProps {
  storeId: string
  summary: {
    status?: string | null
    lastSync?: string | null
    nextSync?: string | null
    successRate?: number | null
  }
  stats24h: IZeDeliveryStats24h
  settings: IZeDeliveryStoreSettings
  onSyncNow: () => void
  onToggleEnabled: (enabled: boolean) => void
  onViewLogs: () => void
  syncInProgress?: boolean
  toggleInProgress?: boolean
}

function formatRelativeDate(value?: string | null) {
  if (!value) {
    return '--'
  }

  const date = new Date(value)
  const diffMs = date.getTime() - Date.now()
  const diffMinutes = Math.round(diffMs / 60000)
  const formatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, 'minute')
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, 'hour')
  }

  const diffDays = Math.round(diffHours / 24)
  return formatter.format(diffDays, 'day')
}

function formatPercentage(value?: number | null) {
  if (value == null || Number.isNaN(value)) {
    return '--'
  }

  return `${(value * 100).toFixed(1)}%`
}

function formatDuration(ms?: number | null) {
  if (!ms) {
    return '--'
  }

  return `${(ms / 1000).toFixed(1)}s`
}

function resolveStatusLabel(status?: string | null, enabled = true) {
  if (!enabled) {
    return 'Desativado'
  }

  if (status === 'degraded') {
    return 'Erro'
  }

  if (status === 'running') {
    return 'Sincronizando'
  }

  return 'Ativo'
}

function resolveStatusTone(status?: string | null, enabled = true) {
  if (!enabled) {
    return 'warning'
  }

  if (status === 'degraded') {
    return 'danger'
  }

  return 'success'
}

function ZeDeliveryStatus({
  storeId,
  summary,
  stats24h,
  settings,
  onSyncNow,
  onToggleEnabled,
  onViewLogs,
  syncInProgress = false,
  toggleInProgress = false,
}: IZeDeliveryStatusProps) {
  const statusLabel = resolveStatusLabel(summary.status, settings.enabled)
  const statusTone = resolveStatusTone(summary.status, settings.enabled)

  return (
    <section className="ze-delivery-status">
      <article className="ze-delivery-status__hero surface-card">
        <div className="ze-delivery-status__hero-head">
          <div>
            <p className="ze-delivery-status__eyebrow">Integracao monitorada</p>
            <h2 className="ze-delivery-status__title">Ze Delivery · Loja {storeId}</h2>
            <p className="ze-delivery-status__subtitle">
              Ultima sincronizacao {formatRelativeDate(summary.lastSync)} · proxima{' '}
              {formatRelativeDate(summary.nextSync)}
            </p>
          </div>
          <span
            className={[
              'ze-delivery-status__badge',
              `ze-delivery-status__badge--${statusTone}`,
            ].join(' ')}
          >
            {statusTone === 'success' ? 'OK' : statusTone === 'danger' ? 'ERRO' : 'PAUSADO'} ·{' '}
            {statusLabel}
          </span>
        </div>

        <div className="ze-delivery-status__hero-grid">
          <div className="ze-delivery-status__signal">
            <span className="ze-delivery-status__signal-label">Taxa de sucesso</span>
            <strong>{formatPercentage(summary.successRate)}</strong>
          </div>
          <div className="ze-delivery-status__signal">
            <span className="ze-delivery-status__signal-label">Intervalo efetivo</span>
            <strong>{settings.intervalMinutes} min</strong>
          </div>
          <div className="ze-delivery-status__signal">
            <span className="ze-delivery-status__signal-label">Webhook de alerta</span>
            <strong>{settings.notificationsEnabled ? 'Ligado' : 'Desligado'}</strong>
          </div>
        </div>

        <div className="ze-delivery-status__controls">
          <Button
            variant="primary"
            onClick={onSyncNow}
            loading={syncInProgress}
            loadingLabel="Disparando sincronizacao"
          >
            Sincronizar agora
          </Button>
          <Button variant="secondary" onClick={onViewLogs}>
            Ver logs
          </Button>
          <div className="ze-delivery-status__toggle">
            <span className="ze-delivery-status__toggle-copy">
              {toggleInProgress ? 'Atualizando status...' : 'Ativar sincronizacao automatica'}
            </span>
            <Toggle
              id={`ze-delivery-toggle-${storeId}`}
              checked={settings.enabled}
              disabled={toggleInProgress}
              tabIndex={0}
              onChange={onToggleEnabled}
              label={settings.enabled ? 'Ativo' : 'Desativado'}
            />
          </div>
        </div>
      </article>

      <div className="card-grid">
        <MetricCard
          label="Entregas sincronizadas"
          value={String(stats24h.deliveriesSynced)}
          delta=""
          description="janela das ultimas 24 horas"
          badge="24h"
          variant="info"
        />
        <MetricCard
          label="Erros"
          value={String(stats24h.errors)}
          delta=""
          description="tentativas com falha no periodo"
          badge="alerta"
          variant={stats24h.errors > 0 ? 'danger' : 'success'}
        />
        <MetricCard
          label="Tempo medio"
          value={formatDuration(stats24h.averageDurationMs)}
          delta=""
          description="duracao media por ciclo"
          badge="latencia"
          variant="neutral"
        />
        <MetricCard
          label="Taxa de falha"
          value={formatPercentage(stats24h.failureRate)}
          delta=""
          description="proporcao de falhas nas ultimas 24h"
          badge="qualidade"
          variant={stats24h.failureRate > 0.05 ? 'danger' : 'success'}
        />
      </div>
    </section>
  )
}

export default ZeDeliveryStatus
