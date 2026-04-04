import { useEffect, useMemo, useState } from 'react'

import SurfaceCard from '../../../components/common/SurfaceCard'
import { useAuth } from '../../../contexts/AuthContext'
import { useStore } from '../../../contexts/StoreContext'
import { buildAuditActor, recordAuditLog } from '../../../services/auditLog'
import { firebaseReady } from '../../../services/firebaseAuthRuntime'
import {
  createFinancialClosure,
  createFinancialOccurrence,
  createManualExpense,
  getFinanceEntryDirection,
  isFinanceEntryActive,
  getFinancialOccurrenceStatusMeta,
  subscribeToFinancialClosures,
  subscribeToFinancialEntries,
  subscribeToFinancialOccurrences,
  updateFinancialOccurrenceStatus,
} from '../../../services/finance'
import { printOccurrenceReport } from '../../../services/occurrencePrint'
import { playError, playSuccess } from '../../../services/soundManager'
import { storeUserOptions } from '../../../services/localUsers'
import FinanceIndicators from './FinanceIndicators'
import FinanceMovementsTable from './FinanceMovementsTable'
import FinanceSummaryCards from './FinanceSummaryCards'
import Select from '../../../components/ui/Select'
import EmptyState from '../../../components/ui/EmptyState'

const initialExpenseForm = {
  description: '',
  amount: '',
  cashierName: 'Geral',
  occurredAt: '',
}

const initialClosureForm = {
  cashierName: 'Geral',
}

const initialOccurrenceForm = {
  destinationSector: 'Financeiro / RH',
  category: 'Ocorrencia financeira',
  title: '',
  reference: '',
  amount: '',
  cashierName: 'Geral',
  occurredAt: '',
  description: '',
}

function getCurrentDateTimeLocal() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value ?? 0))
}

function formatDateTime(value) {
  if (!value) {
    return '--'
  }

  const dateValue = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateValue)
}

function formatDateInputValue(dateValue) {
  const year = dateValue.getFullYear()
  const month = String(dateValue.getMonth() + 1).padStart(2, '0')
  const day = String(dateValue.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isWithinPeriod(createdAt, startDate, endDate) {
  if (!createdAt) {
    return false
  }

  const value = typeof createdAt?.toDate === 'function' ? createdAt.toDate() : new Date(createdAt)

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`)
    if (value < start) {
      return false
    }
  }

  if (endDate) {
    const end = new Date(`${endDate}T23:59:59`)
    if (value > end) {
      return false
    }
  }

  return true
}

function FinanceModule() {
  const { can, session } = useAuth()
  const { currentStoreId, tenantId } = useStore()
  const [entries, setEntries] = useState([])
  const [closures, setClosures] = useState([])
  const [occurrences, setOccurrences] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingExpense, setSavingExpense] = useState(false)
  const [savingClosure, setSavingClosure] = useState(false)
  const [printingOccurrence, setPrintingOccurrence] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [occurrenceSearchTerm, setOccurrenceSearchTerm] = useState('')
  const [occurrenceDestinationFilter, setOccurrenceDestinationFilter] = useState('todos')
  const [occurrenceStatusFilter, setOccurrenceStatusFilter] = useState('todos')
  const [startDate, setStartDate] = useState(() => formatDateInputValue(new Date()))
  const [endDate, setEndDate] = useState(() => formatDateInputValue(new Date()))
  const [expenseForm, setExpenseForm] = useState(() => ({
    ...initialExpenseForm,
    occurredAt: getCurrentDateTimeLocal(),
  }))
  const [closureForm, setClosureForm] = useState(initialClosureForm)
  const [occurrenceForm, setOccurrenceForm] = useState(() => ({
    ...initialOccurrenceForm,
    occurredAt: getCurrentDateTimeLocal(),
    cashierName: session?.operatorName ?? initialOccurrenceForm.cashierName,
  }))

  useEffect(() => {
    setOccurrenceForm((current) => ({
      ...current,
      cashierName:
        current.cashierName && current.cashierName !== initialOccurrenceForm.cashierName
          ? current.cashierName
          : (session?.operatorName ?? initialOccurrenceForm.cashierName),
    }))
  }, [session?.operatorName])

  useEffect(() => {
    if (!firebaseReady || !currentStoreId) {
      setLoading(false)
      return undefined
    }

    setLoading(true)
    setErrorMessage('')

    const unsubEntries = subscribeToFinancialEntries(
      currentStoreId,
      (nextEntries) => {
        setEntries(nextEntries)
        setLoading(false)
      },
      (error) => {
        setErrorMessage(error.message)
        setLoading(false)
      },
    )

    const unsubClosures = subscribeToFinancialClosures(
      currentStoreId,
      (nextClosures) => {
        setClosures(nextClosures)
      },
      (error) => {
        setErrorMessage(error.message)
      },
    )

    const unsubOccurrences = subscribeToFinancialOccurrences(
      currentStoreId,
      (nextOccurrences) => {
        setOccurrences(nextOccurrences)
      },
      (error) => {
        setErrorMessage(error.message)
      },
    )

    return () => {
      unsubEntries()
      unsubClosures()
      unsubOccurrences()
    }
  }, [currentStoreId, tenantId])

  const filteredEntries = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return entries.filter((entry) => {
      const matchesPeriod = isWithinPeriod(entry.createdAt, startDate, endDate)
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [entry.description, entry.source, entry.relatedSaleId, entry.cashierName]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch)

      return matchesPeriod && matchesSearch
    })
  }, [endDate, entries, searchTerm, startDate])

  const activeFilteredEntries = useMemo(
    () => filteredEntries.filter((entry) => isFinanceEntryActive(entry)),
    [filteredEntries],
  )

  const totals = useMemo(() => {
    return activeFilteredEntries.reduce(
      (accumulator, entry) => {
        const direction = getFinanceEntryDirection(entry)
        const amount = Number(entry.amount ?? 0)

        if (direction === 'entrada') {
          accumulator.income += amount
        } else {
          accumulator.expense += amount
        }

        return accumulator
      },
      { income: 0, expense: 0 },
    )
  }, [activeFilteredEntries])

  const balance = Number((totals.income - totals.expense).toFixed(2))

  const summaryCards = useMemo(
    () => [
      {
        id: 'balance',
        label: 'Saldo operacional',
        value: formatCurrency(balance),
        meta: 'saldo real do periodo filtrado',
      },
      {
        id: 'income',
        label: 'Entradas',
        value: formatCurrency(totals.income),
        meta: 'vendas e creditos ativos',
      },
      {
        id: 'expenses',
        label: 'Saidas',
        value: formatCurrency(totals.expense),
        meta: 'saidas manuais persistidas',
      },
      {
        id: 'closures',
        label: 'Fechamentos',
        value: String(closures.length).padStart(2, '0'),
        meta: 'fechamentos salvos na store atual',
      },
    ],
    [balance, closures.length, totals.expense, totals.income],
  )

  const indicators = useMemo(() => {
    const salesEntries = activeFilteredEntries.filter((entry) => entry.source === 'venda')
    const pixRevenue = salesEntries
      .filter((entry) =>
        String(entry.paymentMethod ?? '')
          .toLowerCase()
          .includes('pix'),
      )
      .reduce((total, entry) => total + Number(entry.amount ?? 0), 0)
    const cashRevenue = salesEntries
      .filter((entry) =>
        String(entry.paymentMethod ?? '')
          .toLowerCase()
          .includes('dinheiro'),
      )
      .reduce((total, entry) => total + Number(entry.amount ?? 0), 0)
    const cardRevenue = salesEntries
      .filter(
        (entry) =>
          !String(entry.paymentMethod ?? '')
            .toLowerCase()
            .includes('pix') &&
          !String(entry.paymentMethod ?? '')
            .toLowerCase()
            .includes('dinheiro'),
      )
      .reduce((total, entry) => total + Number(entry.amount ?? 0), 0)

    return [
      {
        id: 'cash',
        label: 'Receita em caixa',
        value: formatCurrency(cashRevenue),
        badgeText: 'caixa',
        badgeClass: 'ui-badge--warning',
      },
      {
        id: 'pix',
        label: 'Receita via PIX',
        value: formatCurrency(pixRevenue),
        badgeText: 'digital',
        badgeClass: 'ui-badge--success',
      },
      {
        id: 'cards',
        label: 'Cartao / online',
        value: formatCurrency(cardRevenue),
        badgeText: 'maquininhas',
        badgeClass: 'ui-badge--info',
      },
      {
        id: 'manual',
        label: 'Saidas manuais',
        value: `${activeFilteredEntries.filter((entry) => entry.source === 'manual').length} registros`,
        badgeText: 'controle',
        badgeClass: 'ui-badge--danger',
      },
    ]
  }, [activeFilteredEntries])

  const incomeBreakdown = useMemo(() => {
    return [
      {
        id: 'sales',
        label: 'Vendas confirmadas',
        value: formatCurrency(
          activeFilteredEntries
            .filter(
              (entry) => entry.source === 'venda' && getFinanceEntryDirection(entry) === 'entrada',
            )
            .reduce((total, entry) => total + Number(entry.amount ?? 0), 0),
        ),
      },
    ]
  }, [activeFilteredEntries])

  const expenseBreakdown = useMemo(() => {
    return [
      {
        id: 'manual',
        label: 'Saidas manuais',
        value: formatCurrency(
          activeFilteredEntries
            .filter(
              (entry) => entry.source === 'manual' && getFinanceEntryDirection(entry) === 'saida',
            )
            .reduce((total, entry) => total + Number(entry.amount ?? 0), 0),
        ),
      },
      {
        id: 'inactive-sales',
        label: 'Vendas canceladas/estornadas',
        value: String(
          filteredEntries.filter(
            (entry) => !isFinanceEntryActive(entry) && entry.source === 'venda',
          ).length,
        ).padStart(2, '0'),
      },
    ]
  }, [activeFilteredEntries, filteredEntries])

  const movementRows = useMemo(() => {
    return filteredEntries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      source: entry.source === 'venda' ? 'Venda' : 'Manual',
      relatedSaleId: entry.relatedSaleId ?? null,
      cashierName: entry.cashierName ?? '',
      description: entry.description,
      amount: formatCurrency(entry.amount),
      status: entry.status ?? 'ativa',
      time: formatDateTime(entry.createdAt),
    }))
  }, [filteredEntries])

  const occurrenceRows = useMemo(() => {
    return occurrences.map((entry) => ({
      id: entry.id,
      title: entry.title ?? 'Ocorrencia financeira',
      destinationSector: entry.destinationSector ?? 'Financeiro / RH',
      category: entry.category ?? 'Ocorrencia financeira',
      cashierName: entry.cashierName ?? 'Geral',
      operatorName: entry.operatorName ?? 'Operador',
      amount: entry.amount?.trim() || '--',
      reference: entry.reference?.trim() || '--',
      status: entry.status ?? 'pendente',
      statusMeta: getFinancialOccurrenceStatusMeta(entry.status),
      occurredAt: formatDateTime(entry.occurredAt),
      printedAt: formatDateTime(entry.printedAt || entry.createdAt),
      description: entry.description ?? '',
      rawOccurredAt: entry.occurredAt,
      rawPrintedAt: entry.printedAt || entry.createdAt,
    }))
  }, [occurrences])

  const filteredOccurrenceRows = useMemo(() => {
    const normalizedSearch = occurrenceSearchTerm.trim().toLowerCase()

    return occurrenceRows.filter((entry) => {
      const matchesPeriod = isWithinPeriod(entry.rawOccurredAt, startDate, endDate)
      const matchesDestination =
        occurrenceDestinationFilter === 'todos' ||
        entry.destinationSector === occurrenceDestinationFilter
      const matchesStatus =
        occurrenceStatusFilter === 'todos' || entry.status === occurrenceStatusFilter
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [entry.title, entry.reference, entry.description, entry.cashierName, entry.operatorName]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch)

      return matchesPeriod && matchesDestination && matchesStatus && matchesSearch
    })
  }, [
    endDate,
    occurrenceDestinationFilter,
    occurrenceRows,
    occurrenceSearchTerm,
    occurrenceStatusFilter,
    startDate,
  ])

  async function handleManualExpenseSubmit(event) {
    event.preventDefault()

    if (!currentStoreId) {
      setErrorMessage('Nenhuma store ativa disponivel para registrar saidas.')
      playError()
      return
    }

    if (!can('finance:write')) {
      setErrorMessage('Seu perfil nao pode registrar saidas financeiras.')
      playError()
      return
    }

    setSavingExpense(true)
    setErrorMessage('')
    setFeedbackMessage('')

    try {
      const entryId = await createManualExpense({
        storeId: currentStoreId,
        tenantId,
        values: expenseForm,
      })
      await recordAuditLog({
        storeId: currentStoreId,
        tenantId,
        actor: buildAuditActor(session),
        action: 'financial.expense_created',
        entityType: 'financial_entry',
        entityId: entryId,
        description: `Saida manual registrada: ${expenseForm.description} (${expenseForm.amount}).`,
      })

      setExpenseForm({
        ...initialExpenseForm,
        occurredAt: getCurrentDateTimeLocal(),
      })
      setFeedbackMessage('Saida manual registrada com sucesso.')
      playSuccess()
    } catch (error) {
      setErrorMessage(error.message)
      playError()
    } finally {
      setSavingExpense(false)
    }
  }

  async function handleClosureSubmit(event) {
    event.preventDefault()

    if (!currentStoreId) {
      setErrorMessage('Nenhuma store ativa disponivel para registrar fechamento.')
      playError()
      return
    }

    if (!can('finance:write')) {
      setErrorMessage('Seu perfil nao pode registrar fechamentos.')
      playError()
      return
    }

    setSavingClosure(true)
    setErrorMessage('')
    setFeedbackMessage('')

    try {
      const closureId = await createFinancialClosure({
        storeId: currentStoreId,
        tenantId,
        values: {
          cashierName: closureForm.cashierName,
          startDate,
          endDate,
          totalIncome: totals.income,
          totalExpense: totals.expense,
          balance,
        },
      })
      await recordAuditLog({
        storeId: currentStoreId,
        tenantId,
        actor: buildAuditActor(session),
        action: 'financial.closure_created',
        entityType: 'financial_closure',
        entityId: closureId,
        description: `Fechamento financeiro registrado para ${startDate} ate ${endDate}.`,
      })

      setFeedbackMessage('Fechamento financeiro registrado com sucesso.')
      playSuccess()
    } catch (error) {
      setErrorMessage(error.message)
      playError()
    } finally {
      setSavingClosure(false)
    }
  }

  function updateExpenseField(field, value) {
    setExpenseForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateClosureField(field, value) {
    setClosureForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateOccurrenceField(field, value) {
    setOccurrenceForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleOccurrencePrint(event) {
    event.preventDefault()

    if (!can('finance:write')) {
      setErrorMessage('Seu perfil nao pode imprimir ocorrencias financeiras.')
      playError()
      return
    }

    if (!occurrenceForm.title.trim()) {
      setErrorMessage('Informe um titulo para a ocorrencia.')
      playError()
      return
    }

    if (!occurrenceForm.description.trim()) {
      setErrorMessage('Descreva a ocorrencia que sera enviada no malote.')
      playError()
      return
    }

    setPrintingOccurrence(true)
    setErrorMessage('')
    setFeedbackMessage('')

    try {
      const printedAt = new Date().toISOString()
      const operatorName = session?.displayName ?? session?.operatorName ?? 'Operador'

      const occurrenceId = await createFinancialOccurrence({
        storeId: currentStoreId,
        tenantId,
        values: {
          ...occurrenceForm,
          cashierName: occurrenceForm.cashierName.trim() || 'Geral',
          operatorName,
          printedAt,
        },
      })

      printOccurrenceReport({
        destinationSector: occurrenceForm.destinationSector,
        category: occurrenceForm.category,
        title: occurrenceForm.title.trim(),
        reference: occurrenceForm.reference.trim(),
        amount: occurrenceForm.amount.trim(),
        cashierName: occurrenceForm.cashierName.trim() || 'Geral',
        operatorName,
        occurredAt: occurrenceForm.occurredAt,
        printedAt,
        description: occurrenceForm.description.trim(),
        meta: `Store ${currentStoreId ?? '--'} - ${session?.roleLabel ?? 'Operacao'}`,
      })

      await recordAuditLog({
        storeId: currentStoreId,
        tenantId,
        actor: buildAuditActor(session),
        action: 'financial.occurrence_printed',
        entityType: 'financial_occurrence',
        entityId: occurrenceId,
        description: `Ocorrencia impressa para ${occurrenceForm.destinationSector}: ${occurrenceForm.title.trim()}.`,
      })

      setOccurrenceForm({
        ...initialOccurrenceForm,
        occurredAt: getCurrentDateTimeLocal(),
        cashierName: session?.operatorName ?? initialOccurrenceForm.cashierName,
      })
      setFeedbackMessage('Ocorrencia pronta para impressao no malote.')
      playSuccess()
    } catch (error) {
      setErrorMessage(error.message)
      playError()
    } finally {
      setPrintingOccurrence(false)
    }
  }

  async function handleOccurrenceStatusChange(occurrence, nextStatus) {
    if (!can('finance:write')) {
      setErrorMessage('Seu perfil nao pode atualizar ocorrencias financeiras.')
      playError()
      return
    }

    setErrorMessage('')
    setFeedbackMessage('')

    try {
      await updateFinancialOccurrenceStatus({
        storeId: currentStoreId,
        occurrenceId: occurrence.id,
        status: nextStatus,
      })

      await recordAuditLog({
        storeId: currentStoreId,
        tenantId,
        actor: buildAuditActor(session),
        action: `financial.occurrence_${nextStatus}`,
        entityType: 'financial_occurrence',
        entityId: occurrence.id,
        description: `Ocorrencia ${occurrence.title} marcada como ${nextStatus}.`,
      })

      setFeedbackMessage(`Ocorrencia marcada como ${nextStatus}.`)
      playSuccess()
    } catch (error) {
      setErrorMessage(error.message)
      playError()
    }
  }

  if (!firebaseReady) {
    return (
      <SurfaceCard title="Financeiro">
        <EmptyState message="Firebase nao configurado" />
      </SurfaceCard>
    )
  }

  if (!currentStoreId) {
    return (
      <SurfaceCard title="Financeiro">
        <EmptyState message="Nenhuma store ativa" />
      </SurfaceCard>
    )
  }

  return (
    <section className="finance-module">
      <FinanceSummaryCards items={summaryCards} />

      <SurfaceCard title="Filtro financeiro">
        <div className="finance-toolbar">
          <div className="ui-field">
            <label className="ui-label" htmlFor="finance-search">
              Buscar
            </label>
            <input
              id="finance-search"
              className="ui-input"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Venda, descricao ou caixa"
            />
          </div>
          <div className="ui-field">
            <label className="ui-label" htmlFor="finance-start-date">
              Inicio
            </label>
            <input
              id="finance-start-date"
              className="ui-input"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="ui-field">
            <label className="ui-label" htmlFor="finance-end-date">
              Fim
            </label>
            <input
              id="finance-end-date"
              className="ui-input"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
        </div>
      </SurfaceCard>

      {feedbackMessage ? (
        <div className="auth-error auth-error--success">{feedbackMessage}</div>
      ) : null}
      {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

      <div className="finance-content-grid">
        <FinanceIndicators items={indicators} />

        <div className="finance-breakdown-grid">
          <SurfaceCard title="Entradas">
            <div className="finance-breakdown-list">
              {incomeBreakdown.map((item) => (
                <div
                  key={item.id}
                  className="finance-breakdown-item finance-breakdown-item--income"
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard title="Saidas">
            <div className="finance-breakdown-list">
              {expenseBreakdown.map((item) => (
                <div
                  key={item.id}
                  className="finance-breakdown-item finance-breakdown-item--expense"
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      </div>

      <div className="finance-actions-grid">
        <SurfaceCard title="Registrar saida manual">
          <form className="finance-form-grid" onSubmit={handleManualExpenseSubmit}>
            <div className="ui-field finance-form-grid__wide">
              <label className="ui-label" htmlFor="finance-expense-description">
                Descricao
              </label>
              <input
                id="finance-expense-description"
                className="ui-input"
                value={expenseForm.description}
                onChange={(event) => updateExpenseField('description', event.target.value)}
                placeholder="Ex: sangria, adiantamento, ajuste"
              />
            </div>
            <div className="ui-field">
              <label className="ui-label" htmlFor="finance-expense-amount">
                Valor
              </label>
              <input
                id="finance-expense-amount"
                className="ui-input"
                value={expenseForm.amount}
                onChange={(event) => updateExpenseField('amount', event.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="ui-field">
              <label className="ui-label" htmlFor="finance-expense-cashier">
                Caixa
              </label>
              <Select
                id="finance-expense-cashier"
                className="ui-select"
                value={expenseForm.cashierName}
                onChange={(event) => updateExpenseField('cashierName', event.target.value)}
              >
                <option value="Geral">Geral</option>
                {storeUserOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
            <div className="ui-field finance-form-grid__wide">
              <label className="ui-label" htmlFor="finance-expense-date">
                Data e hora
              </label>
              <input
                id="finance-expense-date"
                className="ui-input"
                type="datetime-local"
                value={expenseForm.occurredAt}
                onChange={(event) => updateExpenseField('occurredAt', event.target.value)}
              />
            </div>
            <div className="finance-form-actions">
              <button
                type="submit"
                className="ui-button ui-button--secondary"
                disabled={savingExpense || !can('finance:write')}
              >
                {savingExpense ? 'Salvando...' : 'Registrar saida'}
              </button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard title="Fechamento do periodo">
          <form className="finance-form-grid" onSubmit={handleClosureSubmit}>
            <div className="ui-field">
              <label className="ui-label" htmlFor="finance-closure-cashier">
                Caixa
              </label>
              <Select
                id="finance-closure-cashier"
                className="ui-select"
                value={closureForm.cashierName}
                onChange={(event) => updateClosureField('cashierName', event.target.value)}
              >
                <option value="Geral">Geral</option>
                {storeUserOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
            <div className="ui-field">
              <label className="ui-label">Entradas</label>
              <div className="finance-readonly">{formatCurrency(totals.income)}</div>
            </div>
            <div className="ui-field">
              <label className="ui-label">Saidas</label>
              <div className="finance-readonly">{formatCurrency(totals.expense)}</div>
            </div>
            <div className="ui-field">
              <label className="ui-label">Saldo</label>
              <div className="finance-readonly">{formatCurrency(balance)}</div>
            </div>
            <div className="finance-form-actions finance-form-actions--split">
              <span className="ui-badge ui-badge--info">{closures.length} fechamentos salvos</span>
              <button
                type="submit"
                className="ui-button ui-button--secondary"
                disabled={savingClosure || !can('finance:write')}
              >
                {savingClosure ? 'Fechando...' : 'Registrar fechamento'}
              </button>
            </div>
          </form>
        </SurfaceCard>
      </div>

      <SurfaceCard title="Ocorrencia para malote">
        <form
          className="finance-form-grid finance-form-grid--occurrence"
          onSubmit={handleOccurrencePrint}
        >
          <div className="ui-field">
            <label className="ui-label" htmlFor="finance-occurrence-destination">
              Destino
            </label>
            <Select
              id="finance-occurrence-destination"
              className="ui-select"
              value={occurrenceForm.destinationSector}
              onChange={(event) => updateOccurrenceField('destinationSector', event.target.value)}
            >
              <option value="Financeiro / RH">Financeiro / RH</option>
              <option value="Financeiro">Financeiro</option>
              <option value="RH">RH</option>
            </Select>
          </div>
          <div className="ui-field">
            <label className="ui-label" htmlFor="finance-occurrence-category">
              Classificacao
            </label>
            <Select
              id="finance-occurrence-category"
              className="ui-select"
              value={occurrenceForm.category}
              onChange={(event) => updateOccurrenceField('category', event.target.value)}
            >
              <option value="Ocorrencia financeira">Ocorrencia financeira</option>
              <option value="Sangria / caixa">Sangria / caixa</option>
              <option value="Divergencia operacional">Divergencia operacional</option>
              <option value="Ajuste manual">Ajuste manual</option>
            </Select>
          </div>
          <div className="ui-field finance-form-grid__wide">
            <label className="ui-label" htmlFor="finance-occurrence-title">
              Titulo
            </label>
            <input
              id="finance-occurrence-title"
              className="ui-input"
              value={occurrenceForm.title}
              onChange={(event) => updateOccurrenceField('title', event.target.value)}
              placeholder="Ex: possivel sangria duplicada no fechamento do turno"
            />
          </div>
          <div className="ui-field">
            <label className="ui-label" htmlFor="finance-occurrence-reference">
              Referencia
            </label>
            <input
              id="finance-occurrence-reference"
              className="ui-input"
              value={occurrenceForm.reference}
              onChange={(event) => updateOccurrenceField('reference', event.target.value)}
              placeholder="Venda, ajuste, turno, caixa"
            />
          </div>
          <div className="ui-field">
            <label className="ui-label" htmlFor="finance-occurrence-amount">
              Valor impactado
            </label>
            <input
              id="finance-occurrence-amount"
              className="ui-input"
              value={occurrenceForm.amount}
              onChange={(event) => updateOccurrenceField('amount', event.target.value)}
              placeholder="Ex: R$ 120,00"
            />
          </div>
          <div className="ui-field">
            <label className="ui-label" htmlFor="finance-occurrence-cashier">
              Responsavel / caixa
            </label>
            <Select
              id="finance-occurrence-cashier"
              className="ui-select"
              value={occurrenceForm.cashierName}
              onChange={(event) => updateOccurrenceField('cashierName', event.target.value)}
            >
              <option value="Geral">Geral</option>
              {storeUserOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <div className="ui-field">
            <label className="ui-label" htmlFor="finance-occurrence-date">
              Data e hora
            </label>
            <input
              id="finance-occurrence-date"
              className="ui-input"
              type="datetime-local"
              value={occurrenceForm.occurredAt}
              onChange={(event) => updateOccurrenceField('occurredAt', event.target.value)}
            />
          </div>
          <div className="ui-field finance-form-grid__full">
            <label className="ui-label" htmlFor="finance-occurrence-description">
              Descricao da ocorrencia
            </label>
            <textarea
              id="finance-occurrence-description"
              className="finance-textarea"
              rows="6"
              value={occurrenceForm.description}
              onChange={(event) => updateOccurrenceField('description', event.target.value)}
              placeholder="Descreva o que aconteceu, o impacto e o que deve ser verificado pelo Financeiro / RH."
            />
          </div>
          <div className="finance-form-actions finance-form-actions--split">
            <span className="finance-help-copy">
              Documento termico 80x297mm para seguir no malote com assinatura de recebimento.
            </span>
            <button
              type="submit"
              className="ui-button ui-button--primary"
              disabled={printingOccurrence || !can('finance:write')}
            >
              {printingOccurrence ? 'Preparando...' : 'Imprimir ocorrencia'}
            </button>
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard title="Ocorrencias emitidas">
        <div className="finance-table-meta">
          <span className="ui-badge ui-badge--info">
            {filteredOccurrenceRows.length} ocorrencias visiveis
          </span>
          <span className="ui-badge ui-badge--warning">
            {occurrenceRows.filter((entry) => entry.status === 'encaminhada').length} encaminhadas
          </span>
          <span className="ui-badge ui-badge--success">
            {occurrenceRows.filter((entry) => entry.status === 'resolvida').length} resolvidas
          </span>
        </div>

        <div className="finance-toolbar finance-toolbar--occurrence">
          <div className="ui-field">
            <label className="ui-label" htmlFor="finance-occurrence-search">
              Buscar ocorrencia
            </label>
            <input
              id="finance-occurrence-search"
              className="ui-input"
              value={occurrenceSearchTerm}
              onChange={(event) => setOccurrenceSearchTerm(event.target.value)}
              placeholder="Titulo, referencia, operador"
            />
          </div>
          <div className="ui-field">
            <label className="ui-label" htmlFor="finance-occurrence-destination-filter">
              Destino
            </label>
            <Select
              id="finance-occurrence-destination-filter"
              className="ui-select"
              value={occurrenceDestinationFilter}
              onChange={(event) => setOccurrenceDestinationFilter(event.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="Financeiro / RH">Financeiro / RH</option>
              <option value="Financeiro">Financeiro</option>
              <option value="RH">RH</option>
            </Select>
          </div>
          <div className="ui-field">
            <label className="ui-label" htmlFor="finance-occurrence-status-filter">
              Status
            </label>
            <Select
              id="finance-occurrence-status-filter"
              className="ui-select"
              value={occurrenceStatusFilter}
              onChange={(event) => setOccurrenceStatusFilter(event.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="pendente">Pendentes</option>
              <option value="encaminhada">Encaminhadas</option>
              <option value="resolvida">Resolvidas</option>
            </Select>
          </div>
        </div>

        {filteredOccurrenceRows.length === 0 ? (
          <EmptyState message="Nenhuma ocorrencia emitida" />
        ) : (
          <div className="finance-occurrence-list">
            {filteredOccurrenceRows.map((row) => (
              <article key={row.id} className="finance-occurrence-card">
                <div className="finance-occurrence-card__header">
                  <div>
                    <strong className="finance-occurrence-card__title">{row.title}</strong>
                    <div className="finance-occurrence-card__meta">
                      {row.category} - {row.destinationSector}
                    </div>
                  </div>
                  <span className={`ui-badge ${row.statusMeta.badgeClass}`}>
                    {row.statusMeta.label}
                  </span>
                </div>
                <div className="finance-occurrence-card__grid">
                  <span>
                    <strong>Referencia:</strong> {row.reference}
                  </span>
                  <span>
                    <strong>Valor:</strong> {row.amount}
                  </span>
                  <span>
                    <strong>Caixa:</strong> {row.cashierName}
                  </span>
                  <span>
                    <strong>Operador:</strong> {row.operatorName}
                  </span>
                  <span>
                    <strong>Ocorrencia:</strong> {row.occurredAt}
                  </span>
                  <span>
                    <strong>Ultima impressao:</strong> {row.printedAt}
                  </span>
                </div>
                <p className="finance-occurrence-card__description">{row.description}</p>
                <div className="finance-occurrence-card__actions">
                  <button
                    type="button"
                    className="ui-button ui-button--ghost"
                    onClick={() =>
                      printOccurrenceReport({
                        destinationSector: row.destinationSector,
                        category: row.category,
                        title: row.title,
                        reference: row.reference === '--' ? '' : row.reference,
                        amount: row.amount === '--' ? '' : row.amount,
                        cashierName: row.cashierName,
                        operatorName: row.operatorName,
                        occurredAt: row.rawOccurredAt,
                        printedAt: row.rawPrintedAt,
                        description: row.description,
                        meta: `Store ${currentStoreId ?? '--'} - ${session?.roleLabel ?? 'Operacao'}`,
                      })
                    }
                  >
                    Reimprimir
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--secondary"
                    disabled={row.status === 'encaminhada'}
                    onClick={() => handleOccurrenceStatusChange(row, 'encaminhada')}
                  >
                    Encaminhar
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--primary"
                    disabled={row.status === 'resolvida'}
                    onClick={() => handleOccurrenceStatusChange(row, 'resolvida')}
                  >
                    Resolver
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard title="Movimentacoes financeiras">
        <div className="finance-table-meta">
          <span className="ui-badge ui-badge--success">
            {
              activeFilteredEntries.filter((entry) => getFinanceEntryDirection(entry) === 'entrada')
                .length
            }{' '}
            entradas
          </span>
          <span className="ui-badge ui-badge--danger">
            {
              activeFilteredEntries.filter((entry) => getFinanceEntryDirection(entry) === 'saida')
                .length
            }{' '}
            saidas
          </span>
          <span className="ui-badge ui-badge--info">
            {activeFilteredEntries.filter((entry) => entry.source === 'venda').length} vendas
            observadas
          </span>
        </div>

        {loading ? (
          <EmptyState message="Carregando financeiro..." />
        ) : movementRows.length === 0 ? (
          <EmptyState message="Nenhuma movimentacao encontrada" />
        ) : (
          <FinanceMovementsTable rows={movementRows} />
        )}
      </SurfaceCard>
    </section>
  )
}

export default FinanceModule
