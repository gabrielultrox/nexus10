import { useEffect, useMemo, useState } from 'react'

import SurfaceCard from '../../../components/common/SurfaceCard'
import EmptyState from '../../../components/ui/EmptyState'
import Select from '../../../components/ui/Select'
import { Button, Input, Textarea } from '../../../components/ui'
import { useToast } from '../../../hooks/useToast'
import { printOccurrenceReport } from '../../../services/occurrencePrint'
import {
  attachOccurrenceMaloteReceipt,
  buildOccurrenceMaloteExcel,
  buildOccurrenceMalotePdfHtml,
  buildOccurrenceMalotePrintPayload,
  getOccurrenceMaloteDefaultReceivedAt,
  subscribeToOccurrenceMaloteHistory,
} from '../../../services/occurrenceMalote'

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

function buildReceiptForm(entry, operatorName) {
  return {
    protocolCode: entry?.protocolCode ?? '',
    receivedBy: entry?.receivedBy ?? '',
    receivedAt: entry?.receivedAt
      ? entry.receivedAt.slice(0, 16)
      : getOccurrenceMaloteDefaultReceivedAt(),
    digitalSignature: entry?.digitalSignature ?? operatorName ?? '',
    notes: entry?.notes ?? '',
  }
}

function OccurrenceHistoryPanel({ storeId, session }) {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [editingEntryId, setEditingEntryId] = useState('')
  const [receiptForm, setReceiptForm] = useState(() =>
    buildReceiptForm(null, session?.operatorName ?? session?.displayName ?? ''),
  )

  useEffect(() => {
    return subscribeToOccurrenceMaloteHistory(storeId, setItems)
  }, [storeId])

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return items.filter((item) => {
      const matchesStatus = statusFilter === 'todos' || item.status === statusFilter
      const haystack = [
        item.code,
        item.title,
        item.type,
        item.owner,
        item.protocolCode,
        item.receivedBy,
        item.digitalSignature,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = normalizedSearch.length === 0 || haystack.includes(normalizedSearch)
      return matchesStatus && matchesSearch
    })
  }, [items, searchTerm, statusFilter])

  const statusOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.status).filter(Boolean))),
    [items],
  )

  const activeEntry = useMemo(
    () => items.find((item) => item.id === editingEntryId) ?? null,
    [editingEntryId, items],
  )

  function handleExportExcel() {
    const stamp = new Date().toISOString().slice(0, 10)
    downloadFile(
      buildOccurrenceMaloteExcel(filteredItems),
      'application/vnd.ms-excel;charset=utf-8;',
      `ocorrencias-malote-${stamp}.xls`,
    )
  }

  function handleExportPdf() {
    const printableHtml = buildOccurrenceMalotePdfHtml(filteredItems)
    const printWindow = window.open('', '_blank', 'noopener,noreferrer')

    if (!printWindow) {
      toast.error('Nao foi possivel abrir a janela de impressao.')
      return
    }

    printWindow.document.write(printableHtml)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  function handleReprint(entry) {
    try {
      printOccurrenceReport(buildOccurrenceMalotePrintPayload(entry, session))
    } catch {
      toast.error('Nao foi possivel reimprimir a ocorrencia.')
    }
  }

  function handleStartReceipt(entry) {
    setEditingEntryId(entry.id)
    setReceiptForm(buildReceiptForm(entry, session?.operatorName ?? session?.displayName ?? ''))
  }

  function updateReceiptField(field, value) {
    setReceiptForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleSaveReceipt(event) {
    event.preventDefault()

    if (!editingEntryId) {
      return
    }

    try {
      attachOccurrenceMaloteReceipt({
        storeId,
        entryId: editingEntryId,
        values: receiptForm,
        session,
      })
      toast.success('Protocolo anexado ao historico da ocorrencia.')
      setEditingEntryId('')
    } catch (error) {
      toast.error(error.message ?? 'Nao foi possivel anexar o protocolo.')
    }
  }

  return (
    <SurfaceCard title="Historico de ocorrencias para malote">
      <div className="occurrence-history-panel">
        <div className="native-module__toolbar occurrence-history-panel__toolbar">
          <div className="native-module__toolbar-primary">
            <div className="ui-field">
              <label className="ui-label" htmlFor="occurrence-history-search">
                Buscar
              </label>
              <Input
                id="occurrence-history-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Codigo, titulo, responsavel ou protocolo"
              />
            </div>
            <div className="ui-field">
              <label className="ui-label" htmlFor="occurrence-history-status">
                Filtrar status
              </label>
              <Select
                id="occurrence-history-status"
                className="ui-select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="todos">Todos</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="native-module__toolbar-secondary">
            <div className="native-module__toolbar-summary">
              <span className="ui-badge ui-badge--special">{filteredItems.length} visiveis</span>
              <span className="native-module__toolbar-summary-text">
                {items.length} registro{items.length === 1 ? '' : 's'} no historico do malote
              </span>
            </div>
            <div className="native-module__toolbar-actions">
              <Button type="button" variant="secondary" onClick={handleExportExcel}>
                Exportar Excel
              </Button>
              <Button type="button" variant="ghost" onClick={handleExportPdf}>
                Exportar PDF
              </Button>
            </div>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <EmptyState message="Nenhuma ocorrencia impressa para malote foi encontrada." />
        ) : (
          <div className="occurrence-history-panel__list">
            {filteredItems.map((entry) => (
              <article key={entry.id} className="occurrence-history-panel__card">
                <div className="occurrence-history-panel__card-top">
                  <div>
                    <p className="occurrence-history-panel__eyebrow">
                      {entry.code || 'Sem codigo'}
                    </p>
                    <strong className="occurrence-history-panel__title">{entry.title}</strong>
                  </div>
                  <span className="ui-badge ui-badge--info">{entry.status}</span>
                </div>
                <p className="occurrence-history-panel__description">
                  {entry.type || entry.description || 'Ocorrencia operacional'}
                </p>
                <div className="occurrence-history-panel__meta">
                  <span>Operador responsavel: {entry.owner || '--'}</span>
                  <span>
                    Impresso:{' '}
                    {entry.printedAt ? new Date(entry.printedAt).toLocaleString('pt-BR') : '--'}
                  </span>
                  <span>Protocolo: {entry.protocolCode || 'Pendente'}</span>
                  <span>Recebido por: {entry.receivedBy || 'Nao informado'}</span>
                </div>
                <div className="occurrence-history-panel__actions">
                  <Button type="button" variant="ghost" onClick={() => handleReprint(entry)}>
                    Reimprimir
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleStartReceipt(entry)}
                  >
                    {entry.protocolCode ? 'Editar protocolo' : 'Anexar protocolo'}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        {activeEntry ? (
          <form className="occurrence-history-panel__receipt-form" onSubmit={handleSaveReceipt}>
            <div className="occurrence-history-panel__receipt-header">
              <div>
                <p className="occurrence-history-panel__eyebrow">Protocolo de recebimento</p>
                <strong>{activeEntry.title}</strong>
              </div>
              <span className="ui-badge ui-badge--warning">
                {activeEntry.protocolCode ? 'Atualizacao' : 'Novo protocolo'}
              </span>
            </div>
            <div className="native-module__form-grid occurrence-history-panel__receipt-grid">
              <div className="ui-field">
                <label className="ui-label" htmlFor="occurrence-receipt-protocol">
                  Protocolo
                </label>
                <Input
                  id="occurrence-receipt-protocol"
                  value={receiptForm.protocolCode}
                  onChange={(event) => updateReceiptField('protocolCode', event.target.value)}
                  placeholder="MAL-20260404..."
                />
              </div>
              <div className="ui-field">
                <label className="ui-label" htmlFor="occurrence-receipt-received-by">
                  Recebido por
                </label>
                <Input
                  id="occurrence-receipt-received-by"
                  value={receiptForm.receivedBy}
                  onChange={(event) => updateReceiptField('receivedBy', event.target.value)}
                  placeholder="Nome do Financeiro/RH"
                />
              </div>
              <div className="ui-field">
                <label className="ui-label" htmlFor="occurrence-receipt-received-at">
                  Data e hora
                </label>
                <Input
                  id="occurrence-receipt-received-at"
                  type="datetime-local"
                  value={receiptForm.receivedAt}
                  onChange={(event) => updateReceiptField('receivedAt', event.target.value)}
                />
              </div>
              <div className="ui-field">
                <label className="ui-label" htmlFor="occurrence-receipt-signature">
                  Assinatura digital
                </label>
                <Input
                  id="occurrence-receipt-signature"
                  value={receiptForm.digitalSignature}
                  onChange={(event) => updateReceiptField('digitalSignature', event.target.value)}
                  placeholder="Nome, rubrica ou identificacao"
                />
              </div>
              <div className="ui-field occurrence-history-panel__receipt-notes">
                <label className="ui-label" htmlFor="occurrence-receipt-notes">
                  Observacoes
                </label>
                <Textarea
                  id="occurrence-receipt-notes"
                  rows={3}
                  value={receiptForm.notes}
                  onChange={(event) => updateReceiptField('notes', event.target.value)}
                  placeholder="Observacoes do recebimento no malote"
                />
              </div>
            </div>
            <div className="native-module__form-actions">
              <Button type="button" variant="ghost" onClick={() => setEditingEntryId('')}>
                Cancelar
              </Button>
              <Button type="submit" variant="secondary">
                Salvar protocolo
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </SurfaceCard>
  )
}

export default OccurrenceHistoryPanel
