import { useEffect, useMemo, useState } from 'react'

import PageIntro from '../../components/common/PageIntro'
import {
  Button,
  Card,
  EmptyState,
  ErrorDisplay,
  FormField,
  Input,
  LoadingOverlay,
  Select,
  Table,
} from '../../components/ui'
import { useToast } from '../../hooks/useToast'
import { useStore } from '../../contexts/StoreContext'
import {
  buildDefaultReportFilters,
  downloadReportFile,
  generateReport,
  listReportHistory,
} from '../../services/reportService'

const reportTypeOptions = [
  { value: 'sales', label: 'Vendas' },
  { value: 'cash', label: 'Caixa' },
  { value: 'deliveries', label: 'Entregas' },
  { value: 'operations', label: 'Historico operacional' },
  { value: 'audit', label: 'Auditoria' },
]

const reportFormatOptions = [
  { value: 'pdf', label: 'PDF' },
  { value: 'excel', label: 'Excel' },
]

const templateOptions = [
  { value: 'default', label: 'Padrao da loja' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'operacional', label: 'Operacional' },
  { value: 'compliance', label: 'Compliance' },
]

function formatDateTime(value) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatDuration(value) {
  const duration = Number(value ?? 0)

  if (!duration) {
    return '-'
  }

  if (duration < 1_000) {
    return `${duration} ms`
  }

  return `${(duration / 1_000).toFixed(1)} s`
}

function formatStatus(status) {
  const normalized = String(status ?? '').toLowerCase()

  if (normalized === 'completed') {
    return 'Concluido'
  }

  if (normalized === 'processing') {
    return 'Processando'
  }

  if (normalized === 'failed') {
    return 'Falhou'
  }

  return 'Na fila'
}

function buildQueueStats(items) {
  const total = items.length
  const completed = items.filter((item) => item.status === 'completed').length
  const failed = items.filter((item) => item.status === 'failed').length
  const processing = items.filter((item) => item.status === 'processing').length

  return {
    total,
    completed,
    failed,
    processing,
  }
}

function ReportGenerator() {
  const { currentStoreId, loading: storeLoading } = useStore()
  const toast = useToast()
  const [filters, setFilters] = useState(buildDefaultReportFilters)
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [downloadingId, setDownloadingId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function loadHistory(options = {}) {
    if (!currentStoreId) {
      setHistory([])
      setLoadingHistory(false)
      return
    }

    if (!options.silent) {
      setLoadingHistory(true)
    }

    try {
      const response = await listReportHistory({ storeId: currentStoreId, limit: 20 })
      setHistory(Array.isArray(response) ? response : response.data ?? [])
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel carregar o historico de relatorios.')
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [currentStoreId])

  useEffect(() => {
    const hasPending = history.some((item) => ['queued', 'processing'].includes(item.status))

    if (!currentStoreId || !hasPending) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      void loadHistory({ silent: true })
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [currentStoreId, history])

  const stats = useMemo(() => buildQueueStats(history), [history])

  const tableColumns = useMemo(
    () => [
      {
        key: 'createdAt',
        label: 'Gerado em',
        sortable: true,
        render: (row) => formatDateTime(row.createdAt),
      },
      {
        key: 'type',
        label: 'Relatorio',
        render: (row) => reportTypeOptions.find((option) => option.value === row.type)?.label ?? row.type,
      },
      {
        key: 'format',
        label: 'Formato',
        render: (row) => String(row.format ?? '').toUpperCase(),
      },
      {
        key: 'status',
        label: 'Status',
        render: (row) => formatStatus(row.status),
      },
      {
        key: 'durationMs',
        label: 'Tempo',
        render: (row) => formatDuration(row.durationMs),
      },
      {
        key: 'actions',
        label: 'Acao',
        render: (row) => (
          <div className="reports-generator__table-actions">
            <Button
              variant="ghost"
              disabled={row.status !== 'completed' || downloadingId === row.id}
              loading={downloadingId === row.id}
              onClick={() => handleDownload(row)}
            >
              Baixar
            </Button>
          </div>
        ),
      },
    ],
    [downloadingId],
  )

  function updateFilter(field, value) {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleGenerate(event) {
    event.preventDefault()

    if (!currentStoreId) {
      toast.error('Selecione uma loja ativa antes de gerar relatorios.')
      return
    }

    setSubmitting(true)

    try {
      await generateReport({
        storeId: currentStoreId,
        ...filters,
        scheduledFor: filters.scheduledFor || null,
      })
      toast.success('Relatorio enviado para a fila de processamento.')
      setErrorMessage('')
      await loadHistory({ silent: true })
    } catch (error) {
      const message = error.message ?? 'Nao foi possivel gerar o relatorio.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDownload(report) {
    setDownloadingId(report.id)

    try {
      await downloadReportFile({
        reportId: report.id,
        storeId: currentStoreId,
        fileName: report.fileName,
      })
    } catch (error) {
      const message = error.message ?? 'Nao foi possivel baixar o relatorio.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setDownloadingId('')
    }
  }

  return (
    <div className="page-stack reports-generator-page">
      <PageIntro
        eyebrow="Analise"
        title="Relatorios"
        description="Gere PDF ou Excel por periodo, acompanhe a fila e baixe os arquivos processados."
      />

      <div className="card-grid">
        <Card title="Fila total">
          <Card.Header>
            <h2 className="text-section-title">Fila total</h2>
          </Card.Header>
          <Card.Body>
            <strong className="reports-generator__metric">{stats.total}</strong>
            <p className="text-body">Relatorios registrados no historico recente.</p>
          </Card.Body>
        </Card>
        <Card title="Concluidos">
          <Card.Header>
            <h2 className="text-section-title">Concluidos</h2>
          </Card.Header>
          <Card.Body>
            <strong className="reports-generator__metric">{stats.completed}</strong>
            <p className="text-body">Arquivos prontos para download.</p>
          </Card.Body>
        </Card>
        <Card title="Processando">
          <Card.Header>
            <h2 className="text-section-title">Processando</h2>
          </Card.Header>
          <Card.Body>
            <strong className="reports-generator__metric">{stats.processing}</strong>
            <p className="text-body">Itens ainda em fila ou processamento.</p>
          </Card.Body>
        </Card>
        <Card title="Falhas">
          <Card.Header>
            <h2 className="text-section-title">Falhas</h2>
          </Card.Header>
          <Card.Body>
            <strong className="reports-generator__metric">{stats.failed}</strong>
            <p className="text-body">Revise filtros ou limite do arquivo.</p>
          </Card.Body>
        </Card>
      </div>

      <Card>
        <Card.Header>
          <h2 className="text-section-title">Gerar relatorio</h2>
        </Card.Header>
        <Card.Body>
          <form className="reports-generator__form" onSubmit={handleGenerate}>
            <FormField label="Inicio" htmlFor="report-start-date" required>
              <Input
                id="report-start-date"
                type="date"
                value={filters.startDate}
                onChange={(event) => updateFilter('startDate', event.target.value)}
                required
              />
            </FormField>
            <FormField label="Fim" htmlFor="report-end-date" required>
              <Input
                id="report-end-date"
                type="date"
                value={filters.endDate}
                onChange={(event) => updateFilter('endDate', event.target.value)}
                required
              />
            </FormField>
            <FormField label="Tipo" htmlFor="report-type">
              <Select
                id="report-type"
                value={filters.type}
                onChange={(event) => updateFilter('type', event.target.value)}
              >
                {reportTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Formato" htmlFor="report-format">
              <Select
                id="report-format"
                value={filters.format}
                onChange={(event) => updateFilter('format', event.target.value)}
              >
                {reportFormatOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Operador" htmlFor="report-operator">
              <Input
                id="report-operator"
                placeholder="Filtrar por operador"
                value={filters.operator}
                onChange={(event) => updateFilter('operator', event.target.value)}
              />
            </FormField>
            <FormField label="Modulo" htmlFor="report-module">
              <Input
                id="report-module"
                placeholder="Ex.: caixa, vendas, clientes"
                value={filters.module}
                onChange={(event) => updateFilter('module', event.target.value)}
              />
            </FormField>
            <FormField label="Template" htmlFor="report-template">
              <Select
                id="report-template"
                value={filters.template}
                onChange={(event) => updateFilter('template', event.target.value)}
              >
                {templateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Agendar para" htmlFor="report-scheduled-for">
              <Input
                id="report-scheduled-for"
                type="datetime-local"
                value={filters.scheduledFor}
                onChange={(event) => updateFilter('scheduledFor', event.target.value)}
              />
            </FormField>

            <div className="reports-generator__actions">
              <Button type="submit" loading={submitting} disabled={storeLoading || !currentStoreId}>
                Gerar relatorio
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setFilters(buildDefaultReportFilters())}
                disabled={submitting}
              >
                Resetar filtros
              </Button>
            </div>
          </form>
        </Card.Body>
      </Card>

      {errorMessage ? <ErrorDisplay message={errorMessage} code="REPORT_001" /> : null}

      <Card>
        <Card.Header>
          <h2 className="text-section-title">Historico de relatorios</h2>
        </Card.Header>
        <Card.Body>
          <div className="reports-generator__history">
            <LoadingOverlay visible={loadingHistory} label="Carregando historico de relatorios" />
            {history.length === 0 && !loadingHistory ? (
              <EmptyState message="Nenhum relatorio gerado ainda para a loja ativa." />
            ) : (
              <Table
                columns={tableColumns}
                data={history}
                emptyMessage="Nenhum relatorio encontrado."
                defaultSort={{ key: 'createdAt', direction: 'desc' }}
                caption="Historico de relatorios"
                paginate={false}
              />
            )}
          </div>
        </Card.Body>
      </Card>
    </div>
  )
}

export default ReportGenerator
