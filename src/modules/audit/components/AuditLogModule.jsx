import { useEffect, useMemo, useState } from 'react'

import MetricCard from '../../../components/common/MetricCard'
import SurfaceCard from '../../../components/common/SurfaceCard'
import { Button, Input } from '../../../components/ui'
import AuditGrid from '../../../components/AuditLog/AuditGrid'
import {
  buildAuditLogsCsv,
  buildAuditLogsExcel,
  buildAuditLogsPdfHtml,
  listAdminAuditLogs,
  listAllAdminAuditLogs,
} from '../../../services/adminAuditLogs'

const INITIAL_FILTERS = {
  date: '',
  user: '',
  action: '',
  module: '',
  entity: '',
  search: '',
}

function downloadFile(content, type, filename) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function AuditLogModule() {
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [page, setPage] = useState(1)
  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadAuditLogs() {
      setLoading(true)
      setErrorMessage('')

      try {
        const response = await listAdminAuditLogs({
          ...filters,
          page,
          limit: pagination.limit,
        })

        if (!isMounted) {
          return
        }

        setLogs(response.items ?? [])
        setPagination(
          response.pagination ?? {
            page,
            limit: pagination.limit,
            total: 0,
            pages: 0,
          },
        )
      } catch (error) {
        if (!isMounted) {
          return
        }

        setLogs([])
        setErrorMessage(error.message ?? 'Nao foi possivel carregar os logs de auditoria.')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadAuditLogs()

    return () => {
      isMounted = false
    }
  }, [filters, page, pagination.limit])

  const metrics = useMemo(() => {
    const uniqueActors = new Set(logs.map((log) => log.actorName).filter(Boolean))
    const uniqueResources = new Set(logs.map((log) => log.resource).filter(Boolean))

    return [
      {
        label: 'Total filtrado',
        value: String(pagination.total).padStart(2, '0'),
        meta: 'registros encontrados com os filtros atuais',
        badgeText: 'logs',
        badgeClass: 'ui-badge--info',
      },
      {
        label: 'Pagina atual',
        value: `${pagination.page}`,
        meta: `${logs.length} itens carregados nesta pagina`,
        badgeText: 'pagina',
        badgeClass: 'ui-badge--special',
      },
      {
        label: 'Atores',
        value: String(uniqueActors.size).padStart(2, '0'),
        meta: 'atores visiveis na pagina atual',
        badgeText: 'atores',
        badgeClass: 'ui-badge--success',
      },
      {
        label: 'Recursos',
        value: String(uniqueResources.size).padStart(2, '0'),
        meta: 'tipos de recurso visiveis na pagina atual',
        badgeText: 'escopo',
        badgeClass: 'ui-badge--warning',
      },
    ]
  }, [logs, pagination.page, pagination.total])

  function updateFilter(key, value) {
    setPage(1)
    setFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  async function handleExportCsv() {
    setExporting(true)

    try {
      const exportItems = await listAllAdminAuditLogs(filters)
      const csvContent = buildAuditLogsCsv(exportItems)
      const stamp = new Date().toISOString().slice(0, 10)
      downloadFile(csvContent, 'text/csv;charset=utf-8;', `audit-logs-${stamp}.csv`)
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel exportar os logs.')
    } finally {
      setExporting(false)
    }
  }

  async function handleExportExcel() {
    setExporting(true)

    try {
      const exportItems = await listAllAdminAuditLogs(filters)
      const content = buildAuditLogsExcel(exportItems)
      const stamp = new Date().toISOString().slice(0, 10)
      downloadFile(content, 'application/vnd.ms-excel;charset=utf-8;', `audit-logs-${stamp}.xls`)
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel exportar os logs.')
    } finally {
      setExporting(false)
    }
  }

  async function handleExportPdf() {
    setExporting(true)

    try {
      const exportItems = await listAllAdminAuditLogs(filters)
      const printableHtml = buildAuditLogsPdfHtml(exportItems)
      const printWindow = window.open('', '_blank', 'noopener,noreferrer')

      if (!printWindow) {
        throw new Error('Nao foi possivel abrir a janela de impressao.')
      }

      printWindow.document.write(printableHtml)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel exportar os logs.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="entity-module audit-log-module">
      <div className="card-grid">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            meta={metric.meta}
            badgeText={metric.badgeText}
            badgeClass={metric.badgeClass}
          />
        ))}
      </div>

      <SurfaceCard title="Filtros de auditoria">
        <div className="entity-toolbar audit-log-toolbar audit-log-toolbar--filters">
          <div className="ui-field">
            <label className="ui-label" htmlFor="audit-log-date">
              Data
            </label>
            <Input
              id="audit-log-date"
              type="date"
              value={filters.date}
              onChange={(event) => updateFilter('date', event.target.value)}
            />
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor="audit-log-action">
              Acao
            </label>
            <Input
              id="audit-log-action"
              value={filters.action}
              onChange={(event) => updateFilter('action', event.target.value)}
              placeholder="CREATE, UPDATE, DELETE..."
            />
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor="audit-log-user">
              Usuario
            </label>
            <Input
              id="audit-log-user"
              value={filters.user}
              onChange={(event) => updateFilter('user', event.target.value)}
              placeholder="Gabriel, uid, role..."
            />
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor="audit-log-module">
              Modulo
            </label>
            <Input
              id="audit-log-module"
              value={filters.module}
              onChange={(event) => updateFilter('module', event.target.value)}
              placeholder="orders, sales, finance..."
            />
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor="audit-log-entity">
              Entidade
            </label>
            <Input
              id="audit-log-entity"
              value={filters.entity}
              onChange={(event) => updateFilter('entity', event.target.value)}
              placeholder="order, sale, customer..."
            />
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor="audit-log-search">
              Busca
            </label>
            <Input
              id="audit-log-search"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="ID, descricao, request-id..."
            />
          </div>
        </div>

        <div className="audit-log-toolbar-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setFilters({ ...INITIAL_FILTERS })
              setPage(1)
            }}
          >
            Limpar filtros
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={handleExportCsv}
            disabled={exporting || loading}
          >
            {exporting ? 'Exportando...' : 'CSV'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={handleExportExcel}
            disabled={exporting || loading}
          >
            Excel
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={handleExportPdf}
            disabled={exporting || loading}
          >
            PDF
          </Button>
        </div>
      </SurfaceCard>

      {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

      <SurfaceCard title="Tabela de auditoria">
        <div className="entity-table-wrap entity-table-wrap--dense">
          <AuditGrid
            items={logs}
            loading={loading}
            emptyMessage="Nenhum log encontrado com os filtros atuais"
          />
        </div>

        {!loading && logs.length > 0 ? (
          <div className="audit-log-pagination">
            <p className="audit-log-pagination__summary">
              Pagina {pagination.page} de {Math.max(pagination.pages, 1)} - {pagination.total}{' '}
              registros
            </p>

            <div className="audit-log-pagination__actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                disabled={pagination.page <= 1}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage((current) => current + 1)}
                disabled={pagination.pages === 0 || pagination.page >= pagination.pages}
              >
                Proxima
              </Button>
            </div>
          </div>
        ) : null}
      </SurfaceCard>
    </section>
  )
}

export default AuditLogModule
