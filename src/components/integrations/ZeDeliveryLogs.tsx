import { useMemo, useState } from 'react'

import { Button, Table } from '../ui'
import type { ITableColumn } from '../ui'
import {
  buildZeDeliveryLogsCsv,
  type IZeDeliveryLogRecord,
} from '../../services/zeDeliveryIntegration'

interface IZeDeliveryLogsProps {
  logs: IZeDeliveryLogRecord[]
  loading?: boolean
  onOpenDetails: (log: IZeDeliveryLogRecord) => void
  onRetry: (log: IZeDeliveryLogRecord) => void
  retryingLogId?: string | null
}

function formatDateTime(value?: string) {
  if (!value) {
    return '--'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDuration(value?: number) {
  if (!value) {
    return '--'
  }

  return `${(value / 1000).toFixed(1)}s`
}

function resolveLogStatus(log: IZeDeliveryLogRecord) {
  return log.summary?.success === false ? 'Error' : 'Success'
}

function downloadCsv(content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)

  anchor.href = url
  anchor.download = `ze-delivery-logs-${stamp}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function ZeDeliveryLogs({
  logs,
  loading = false,
  onOpenDetails,
  onRetry,
  retryingLogId = null,
}: IZeDeliveryLogsProps) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all')

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return logs.filter((log) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'success' && log.summary?.success !== false) ||
        (statusFilter === 'error' && log.summary?.success === false)

      if (!matchesStatus) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      const haystack = [
        log.storeId,
        log.summary?.runId,
        log.summary?.trigger,
        log.summary?.error?.message,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [logs, query, statusFilter])

  const columns = useMemo<Array<ITableColumn<IZeDeliveryLogRecord>>>(
    () => [
      {
        key: 'createdAt',
        label: 'Timestamp',
        sortable: true,
        render: (row) => (
          <div className="ze-delivery-log-cell">
            <strong>{formatDateTime(row.createdAt)}</strong>
            <span>{row.storeId}</span>
          </div>
        ),
      },
      {
        key: 'summary',
        label: 'Entregas',
        render: (row) => String(row.summary?.processed ?? 0),
      },
      {
        key: 'id',
        label: 'Status',
        render: (row) => (
          <span
            className={[
              'ze-delivery-log-status',
              row.summary?.success === false
                ? 'ze-delivery-log-status--error'
                : 'ze-delivery-log-status--success',
            ].join(' ')}
          >
            {row.summary?.success === false ? 'Error' : 'Success'}
          </span>
        ),
      },
      {
        key: 'trigger',
        label: 'Tempo',
        render: (row) => formatDuration(row.summary?.durationMs),
      },
      {
        key: 'storeId',
        label: 'Acao',
        render: (row) => (
          <div className="ze-delivery-log-actions">
            <Button variant="ghost" onClick={() => onOpenDetails(row)}>
              Detalhes
            </Button>
            <Button
              variant="secondary"
              onClick={() => onRetry(row)}
              loading={retryingLogId === row.id}
              loadingLabel="Reenviando"
            >
              Retry
            </Button>
          </div>
        ),
      },
    ],
    [onOpenDetails, onRetry, retryingLogId],
  )

  return (
    <section className="surface-card ze-delivery-logs">
      <div className="ze-delivery-logs__header">
        <div>
          <h3 className="surface-card__title">Historico recente</h3>
          <p className="ze-delivery-logs__subtitle">
            Ultimas 20 sincronizacoes com busca, filtro e exportacao.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => downloadCsv(buildZeDeliveryLogsCsv(filteredLogs))}
          disabled={!filteredLogs.length}
        >
          Exportar CSV
        </Button>
      </div>

      <div className="ze-delivery-logs__filters">
        <div className="ui-field">
          <label className="ui-label" htmlFor="ze-delivery-log-search">
            Buscar
          </label>
          <input
            id="ze-delivery-log-search"
            className="ui-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Run id, loja, trigger, mensagem..."
          />
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor="ze-delivery-log-status-filter">
            Filtrar status
          </label>
          <select
            id="ze-delivery-log-status-filter"
            className="ui-input"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | 'success' | 'error')}
          >
            <option value="all">Todos</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      <Table
        columns={columns}
        data={filteredLogs}
        isLoading={loading}
        pageSize={8}
        emptyMessage="Nenhuma sincronizacao encontrada para os filtros atuais."
        caption="Tabela das sincronizacoes recentes do Ze Delivery"
      />

      <p className="ze-delivery-logs__footnote">
        Exibindo {filteredLogs.length} de {logs.length} registros carregados.
      </p>
    </section>
  )
}

export default ZeDeliveryLogs
