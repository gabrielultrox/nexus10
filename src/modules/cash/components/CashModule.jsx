import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toPng } from 'html-to-image'

import CaixaStatusBar from '../../../components/caixa/CaixaStatusBar'
import PageTabs from '../../../components/common/PageTabs'
import SurfaceCard from '../../../components/common/SurfaceCard'
import FormRow from '../../../components/ui/FormRow'
import DestructiveIconButton from '../../../components/ui/DestructiveIconButton'
import { useAuth } from '../../../contexts/AuthContext'
import { useStore } from '../../../contexts/StoreContext'
import { useConfirm } from '../../../hooks/useConfirm'
import { useToast } from '../../../hooks/useToast'
import { formatCurrencyBRL } from '../../../services/commerce'
import { subscribeToCouriers } from '../../../services/courierService'
import { appendAuditEvent } from '../../../services/localAudit'
import {
  loadResettableLocalRecords,
  saveResettableLocalRecords,
} from '../../../services/localAccess'
import {
  clearManualModuleRecords,
  deleteManualModuleRecord,
  saveManualModuleRecord,
  subscribeToManualModuleRecords,
} from '../../../services/manualModuleService'
import { printCashReceipt } from '../../../services/cashPrint'
import {
  createDefaultCashState,
  loadCashState,
  saveCashState,
  subscribeToCashState,
} from '../../../services/cashStateService'
import { playCashSuccess, playWarning } from '../../../services/soundManager'
import Button from '../../../components/ui/Button'
import Select from '../../../components/ui/Select'
import EmptyState from '../../../components/ui/EmptyState'

const CASH_STORAGE_KEY = 'nexus-module-cash'
const CASH_STATE_STORAGE_KEY = 'nexus-module-cash-state'
const FINANCIAL_PENDING_STORAGE_KEY = 'nexus-module-cash-financial-pending'
const CASH_RESET_HOUR = 3

const CASH_TABS = [
  {
    id: 'opening',
    label: 'Abertura de caixa',
    title: 'Registrar abertura de caixa',
    submitLabel: 'Registrar abertura',
    receiptLabel: 'Abertura de caixa',
    codePrefix: 'ABR',
  },
  {
    id: 'withdrawal',
    label: 'Sangria',
    title: 'Registrar sangria',
    submitLabel: 'Registrar sangria',
    receiptLabel: 'Sangria',
    codePrefix: 'SAN',
  },
  {
    id: 'supply',
    label: 'Suprimento',
    title: 'Registrar suprimento',
    submitLabel: 'Registrar suprimento',
    receiptLabel: 'Suprimento',
    codePrefix: 'SUP',
  },
  {
    id: 'courier-withdrawal',
    label: 'Retirada de entregador',
    title: 'Registrar retirada de entregador',
    submitLabel: 'Registrar retirada',
    receiptLabel: 'Retirada de entregador',
    codePrefix: 'RET',
  },
  {
    id: 'closing',
    label: 'Fechamento de caixa',
    title: 'Registrar fechamento de caixa',
    submitLabel: 'Registrar fechamento',
    receiptLabel: 'Fechamento de caixa',
    codePrefix: 'FEC',
  },
]

const FINANCIAL_PENDING_VIEW = {
  id: 'financial-pending',
  label: 'Pendencias financeiras',
  title: 'Registrar pendencia financeira',
  submitLabel: 'Registrar pendencia',
  receiptLabel: 'Pendencia financeira',
  codePrefix: 'PEN',
}

const FINANCIAL_PENDING_TYPES = [
  { value: 'change-pending', label: 'Troco pendente' },
  { value: 'refund', label: 'Estorno' },
  { value: 'wrong-charge', label: 'Cobranca incorreta' },
  { value: 'other', label: 'Outro ajuste' },
]

const FINANCIAL_PENDING_PRIORITIES = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baixa' },
]

const FINANCIAL_PENDING_CHECKLIST = [
  { key: 'customerContacted', label: 'Cliente contatado' },
  { key: 'amountReviewed', label: 'Valor conferido' },
  { key: 'actionCompleted', label: 'Acao executada' },
]

const initialFinancialPendingForm = {
  customerName: '',
  customerPhone: '',
  type: FINANCIAL_PENDING_TYPES[0].value,
  priority: 'medium',
  amount: '',
  description: '',
}

function createCashId() {
  return `cash-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function createFinancialPendingId() {
  return `financial-pending-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function buildReceiptCode(prefix) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')

  return `${prefix}-${year}${month}${day}-${hours}${minutes}`
}

function formatDateTime(value) {
  const normalized = new Date(value)

  if (Number.isNaN(normalized.getTime())) {
    return '--'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(normalized)
}

function parseCurrencyInput(value) {
  const normalized = String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrencyInput(value) {
  const digitsOnly = String(value ?? '').replace(/\D/g, '')

  if (!digitsOnly) {
    return ''
  }

  const amount = Number(digitsOnly) / 100
  return amount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function sortRecords(records) {
  return [...records].sort((left, right) => {
    const leftTime = Date.parse(left?.createdAtClient ?? '') || 0
    const rightTime = Date.parse(right?.createdAtClient ?? '') || 0

    return rightTime - leftTime
  })
}

function buildCashRecord(tab, amount, note, operatorName, courierName = '') {
  const createdAt = new Date().toISOString()

  return {
    id: createCashId(),
    kind: tab.id,
    kindLabel: tab.receiptLabel,
    amount,
    amountLabel: formatCurrencyBRL(amount),
    note: note.trim(),
    operatorName,
    courierName: courierName.trim(),
    receiptCode: buildReceiptCode(tab.codePrefix),
    createdAtClient: createdAt,
    updatedAtClient: createdAt,
  }
}

function getFinancialPendingTypeLabel(type) {
  return (
    FINANCIAL_PENDING_TYPES.find((entry) => entry.value === type)?.label ?? 'Pendencia financeira'
  )
}

function getFinancialPendingPriorityLabel(priority) {
  return FINANCIAL_PENDING_PRIORITIES.find((entry) => entry.value === priority)?.label ?? 'Media'
}

function getFinancialPendingPriorityBadge(priority) {
  switch (priority) {
    case 'high':
      return 'ui-badge--danger'
    case 'low':
      return 'ui-badge--info'
    default:
      return 'ui-badge--warning'
  }
}

function sortFinancialPendingRecords(records) {
  return [...records].sort((left, right) => {
    const leftResolved = Boolean(left?.resolvedAtClient)
    const rightResolved = Boolean(right?.resolvedAtClient)

    if (leftResolved !== rightResolved) {
      return leftResolved ? 1 : -1
    }

    const leftTime = Date.parse(left?.updatedAtClient ?? left?.createdAtClient ?? '') || 0
    const rightTime = Date.parse(right?.updatedAtClient ?? right?.createdAtClient ?? '') || 0
    return rightTime - leftTime
  })
}

function createDefaultFinancialPendingChecklist() {
  return FINANCIAL_PENDING_CHECKLIST.reduce((accumulator, item) => {
    accumulator[item.key] = false
    return accumulator
  }, {})
}

function isFinancialPendingResolved(record) {
  return Boolean(record?.resolvedAtClient)
}

function isFinancialPendingChecklistComplete(record) {
  return FINANCIAL_PENDING_CHECKLIST.every((item) => Boolean(record?.checklist?.[item.key]))
}

function buildFinancialPendingRecord(formValues, operatorName) {
  const amount = parseCurrencyInput(formValues.amount)

  return {
    id: createFinancialPendingId(),
    customerName: formValues.customerName.trim(),
    customerPhone: formValues.customerPhone.trim(),
    type: formValues.type,
    typeLabel: getFinancialPendingTypeLabel(formValues.type),
    priority: formValues.priority,
    priorityLabel: getFinancialPendingPriorityLabel(formValues.priority),
    amount,
    amountLabel: formatCurrencyBRL(amount),
    description: formValues.description.trim(),
    operatorName,
    checklist: createDefaultFinancialPendingChecklist(),
    resolutionNote: '',
    createdAtClient: new Date().toISOString(),
    updatedAtClient: new Date().toISOString(),
    resolvedAtClient: '',
    resolvedBy: '',
  }
}

function CashMetricCard({ label, value, meta }) {
  return (
    <div className="ui-kpi-card cash-module__metric-card">
      <span className="ui-kpi-card__label">{label}</span>
      <strong className="ui-kpi-card__value">{value}</strong>
      <span className="ui-kpi-card__meta">{meta}</span>
    </div>
  )
}

function FinancialPendingTable({ records, onChecklistToggle, onResolvedToggle, onDelete }) {
  if (records.length === 0) {
    return <EmptyState message="Nenhuma pendencia financeira encontrada" />
  }

  return (
    <div className="cash-module__history-wrap">
      <table className="ui-table cash-module__pending-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Numero</th>
            <th>Tipo</th>
            <th>Valor</th>
            <th>Checklist</th>
            <th>Status</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, rowIndex) => {
            const isResolved = isFinancialPendingResolved(record)
            const checklistComplete = isFinancialPendingChecklistComplete(record)

            return (
              <tr
                key={record.id}
                className="ui-table__row-enter"
                style={{ '--row-delay': `${Math.min(rowIndex * 40, 240)}ms` }}
              >
                <td className="ui-table__cell--strong">
                  <div className="cash-module__pending-identity">
                    <span>{record.customerName}</span>
                    <small>{record.description}</small>
                    <small>{record.operatorName}</small>
                  </div>
                </td>
                <td className="ui-table__cell--muted">{record.customerPhone}</td>
                <td>
                  <div className="cash-module__pending-meta">
                    <span className="ui-badge ui-badge--info">{record.typeLabel}</span>
                    <span
                      className={`ui-badge ${getFinancialPendingPriorityBadge(record.priority)}`}
                    >
                      {record.priorityLabel}
                    </span>
                  </div>
                </td>
                <td className="ui-table__cell--numeric">{record.amountLabel}</td>
                <td>
                  <div className="cash-module__pending-checklist">
                    {FINANCIAL_PENDING_CHECKLIST.map((item) => (
                      <label
                        key={item.key}
                        className={`cash-module__pending-check${record.checklist?.[item.key] ? ' is-checked' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(record.checklist?.[item.key])}
                          onChange={() => onChecklistToggle(record.id, item.key)}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="cash-module__pending-status">
                    <label
                      className={`cash-module__pending-resolve${isResolved ? ' is-resolved' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isResolved}
                        disabled={!isResolved && !checklistComplete}
                        onChange={() => onResolvedToggle(record.id)}
                      />
                      <span>{isResolved ? 'Resolvido' : 'Em aberto'}</span>
                    </label>
                    {!isResolved && !checklistComplete ? (
                      <small>Conclua os 3 checks para encerrar.</small>
                    ) : null}
                    {isResolved ? (
                      <small>{`Fechado em ${formatDateTime(record.resolvedAtClient)}`}</small>
                    ) : null}
                  </div>
                </td>
                <td>
                  <div className="cash-module__history-actions">
                    <Button
                      variant="secondary"
                      onClick={() => onResolvedToggle(record.id)}
                      disabled={!isResolved && !checklistComplete}
                    >
                      {isResolved ? 'Reabrir' : 'Concluir'}
                    </Button>
                    <DestructiveIconButton
                      className="native-module__delete-action"
                      onClick={() => onDelete(record.id)}
                      label="Excluir pendencia"
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CashHistoryTable({ records, onPrint, onDelete }) {
  if (records.length === 0) {
    return <EmptyState message="Nenhum lancamento de caixa hoje" />
  }

  return (
    <div className="cash-module__history-wrap">
      <table className="ui-table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Valor</th>
            <th>Observacao</th>
            <th>Operador</th>
            <th>Data</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, rowIndex) => (
            <tr
              key={record.id}
              className="ui-table__row-enter"
              style={{ '--row-delay': `${Math.min(rowIndex * 40, 240)}ms` }}
            >
              <td className="ui-table__cell--strong">
                <div className="cash-module__history-type">
                  <span>{record.kindLabel}</span>
                  <small>{record.receiptCode}</small>
                  {record.courierName ? <small>{record.courierName}</small> : null}
                </div>
              </td>
              <td className="ui-table__cell--numeric">{record.amountLabel}</td>
              <td className="ui-table__cell--muted">{record.note || 'Sem observacao'}</td>
              <td className="ui-table__cell--muted">{record.operatorName}</td>
              <td className="ui-table__cell--muted">{formatDateTime(record.createdAtClient)}</td>
              <td>
                <div className="cash-module__history-actions">
                  <Button variant="secondary" onClick={() => onPrint(record)}>
                    Imprimir
                  </Button>
                  <DestructiveIconButton
                    className="native-module__delete-action"
                    onClick={() => onDelete(record.id)}
                    label="Excluir lancamento"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FinancialPendingExportCanvas({ records, totalOpenAmount, session }) {
  return (
    <div className="cash-module__pending-export-sheet">
      <header className="cash-module__pending-export-header">
        <div>
          <span className="cash-module__pending-export-eyebrow">NEXUS</span>
          <h2 className="cash-module__pending-export-title">Pendencias financeiras</h2>
          <p className="cash-module__pending-export-meta">
            {new Intl.DateTimeFormat('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date())}
          </p>
        </div>
        <div className="cash-module__pending-export-stamp">
          <span>Em aberto</span>
          <strong>{records.filter((record) => !isFinancialPendingResolved(record)).length}</strong>
        </div>
      </header>

      <div className="cash-module__pending-export-summary">
        <article className="cash-module__pending-export-metric">
          <span>Total de registros</span>
          <strong>{records.length}</strong>
        </article>
        <article className="cash-module__pending-export-metric">
          <span>Valor em risco</span>
          <strong>{formatCurrencyBRL(totalOpenAmount)}</strong>
        </article>
        <article className="cash-module__pending-export-metric">
          <span>Operador</span>
          <strong>{session?.operatorName ?? session?.displayName ?? 'Operador local'}</strong>
        </article>
      </div>

      <div className="cash-module__pending-export-list">
        {records.map((record) => (
          <article key={record.id} className="cash-module__pending-export-card">
            <div className="cash-module__pending-export-card-top">
              <strong>{record.customerName}</strong>
              <span>{isFinancialPendingResolved(record) ? 'Resolvido' : 'Em aberto'}</span>
            </div>
            <div className="cash-module__pending-export-card-body">
              <p>
                <span>Numero</span>
                <strong>{record.customerPhone || 'Nao informado'}</strong>
              </p>
              <p>
                <span>Tipo</span>
                <strong>{record.typeLabel}</strong>
              </p>
              <p>
                <span>Valor</span>
                <strong>{record.amountLabel}</strong>
              </p>
              <p>
                <span>Prioridade</span>
                <strong>{record.priorityLabel}</strong>
              </p>
              <p>
                <span>Descricao</span>
                <strong>{record.description}</strong>
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function CashModule({ mode = 'cash' }) {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [searchParams, setSearchParams] = useSearchParams()
  const isFinancialPendingView = mode === 'financial-pending'
  const activeTabId = isFinancialPendingView
    ? FINANCIAL_PENDING_VIEW.id
    : (searchParams.get('tab') ?? CASH_TABS[0].id)
  const activeTab = isFinancialPendingView
    ? FINANCIAL_PENDING_VIEW
    : (CASH_TABS.find((tab) => tab.id === activeTabId) ?? CASH_TABS[0])
  const [records, setRecords] = useState(() =>
    loadResettableLocalRecords(CASH_STORAGE_KEY, [], CASH_RESET_HOUR),
  )
  const [financialPendingRecords, setFinancialPendingRecords] = useState(() =>
    loadResettableLocalRecords(FINANCIAL_PENDING_STORAGE_KEY, [], CASH_RESET_HOUR),
  )
  const [cashState, setCashState] = useState(() =>
    loadCashState(CASH_STATE_STORAGE_KEY, CASH_RESET_HOUR),
  )
  const [couriers, setCouriers] = useState([])
  const [selectedCourier, setSelectedCourier] = useState('')
  const [valueInput, setValueInput] = useState('')
  const [note, setNote] = useState('')
  const [financialPendingForm, setFinancialPendingForm] = useState(initialFinancialPendingForm)
  const [financialPendingSearch, setFinancialPendingSearch] = useState('')
  const [financialPendingFilter, setFinancialPendingFilter] = useState('open')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [syncMessage, setSyncMessage] = useState('')
  const [financialPendingSyncMessage, setFinancialPendingSyncMessage] = useState('')
  const [confirmAction, setConfirmAction] = useState(null)
  const { session } = useAuth()
  const { currentStoreId, tenantId } = useStore()

  useEffect(() => {
    const unsubscribe = subscribeToManualModuleRecords({
      storeId: currentStoreId,
      modulePath: 'cash',
      storageKey: CASH_STORAGE_KEY,
      initialRecords: [],
      dailyResetHour: CASH_RESET_HOUR,
      onData(nextRecords) {
        setRecords(sortRecords(nextRecords))
      },
      onError() {
        setSyncMessage('Historico local ativo')
      },
    })

    return unsubscribe
  }, [currentStoreId])

  useEffect(() => {
    const unsubscribe = subscribeToCashState({
      storeId: currentStoreId,
      storageKey: CASH_STATE_STORAGE_KEY,
      resetHour: CASH_RESET_HOUR,
      onData(nextState) {
        setCashState(nextState)
      },
      onError() {
        setSyncMessage('Historico local ativo')
      },
    })

    return unsubscribe
  }, [currentStoreId])

  useEffect(
    () =>
      subscribeToCouriers(
        currentStoreId,
        (nextCouriers) => {
          setCouriers(nextCouriers)
        },
        () => {
          setCouriers([])
        },
      ),
    [currentStoreId],
  )

  useEffect(() => {
    const unsubscribe = subscribeToManualModuleRecords({
      storeId: currentStoreId,
      modulePath: 'cash-financial-pending',
      storageKey: FINANCIAL_PENDING_STORAGE_KEY,
      initialRecords: [],
      dailyResetHour: CASH_RESET_HOUR,
      onData(nextRecords) {
        setFinancialPendingRecords(sortFinancialPendingRecords(nextRecords))
      },
      onError() {
        setFinancialPendingSyncMessage('Pendencias financeiras em modo local')
      },
    })

    return unsubscribe
  }, [currentStoreId])

  const totalAmountByTab = useMemo(() => {
    return CASH_TABS.reduce((accumulator, tab) => {
      const total = records
        .filter((record) => record.kind === tab.id)
        .reduce((sum, record) => sum + Number(record.amount ?? 0), 0)

      accumulator[tab.id] = total
      return accumulator
    }, {})
  }, [records])

  const totalDayAmount = useMemo(
    () => records.reduce((sum, record) => sum + Number(record.amount ?? 0), 0),
    [records],
  )
  const balanceDelta = useMemo(
    () =>
      records.reduce((sum, record) => {
        const amount = Number(record.amount ?? 0)

        if (record.kind === 'supply') {
          return sum + amount
        }

        if (record.kind === 'withdrawal' || record.kind === 'courier-withdrawal') {
          return sum - amount
        }

        return sum
      }, 0),
    [records],
  )
  const courierOptions = useMemo(
    () =>
      couriers
        .map((courier) => courier?.name?.trim())
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, 'pt-BR')),
    [couriers],
  )
  const openFinancialPendingRecords = useMemo(
    () => financialPendingRecords.filter((record) => !isFinancialPendingResolved(record)),
    [financialPendingRecords],
  )
  const resolvedFinancialPendingRecords = useMemo(
    () => financialPendingRecords.filter((record) => isFinancialPendingResolved(record)),
    [financialPendingRecords],
  )
  const filteredFinancialPendingRecords = useMemo(() => {
    const normalizedSearch = financialPendingSearch.trim().toLowerCase()

    return financialPendingRecords.filter((record) => {
      const matchesStatus =
        financialPendingFilter === 'all' ||
        (financialPendingFilter === 'open' && !isFinancialPendingResolved(record)) ||
        (financialPendingFilter === 'resolved' && isFinancialPendingResolved(record))
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [
          record.customerName,
          record.customerPhone,
          record.description,
          record.typeLabel,
          record.operatorName,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch)

      return matchesStatus && matchesSearch
    })
  }, [financialPendingFilter, financialPendingRecords, financialPendingSearch])
  const financialPendingAmount = useMemo(
    () =>
      openFinancialPendingRecords.reduce((total, record) => total + Number(record.amount ?? 0), 0),
    [openFinancialPendingRecords],
  )
  const requiresCourier = activeTab.id === 'courier-withdrawal'
  const isCashOpen = cashState.status === 'aberto'
  const pendingCount = openFinancialPendingRecords.length
  const closingDisabled = !isCashOpen
  const openingBlockedMessage =
    activeTab.id === 'opening' && isCashOpen
      ? `O caixa ja foi aberto as ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(cashState.openedAt))}. Use as outras operacoes ou siga para o fechamento.`
      : ''
  const activeTabGuardrailMessage = useMemo(() => {
    if (isFinancialPendingView && openFinancialPendingRecords.length > 0) {
      return `Existem ${openFinancialPendingRecords.length} pendencia(s) abertas para acompanhamento e retorno ao cliente.`
    }

    if (!isCashOpen && activeTab.id === 'opening') {
      return 'Abra o caixa com um valor inicial para liberar sangria, suprimento, retirada e fechamento.'
    }

    if (activeTab.id === 'closing' && pendingCount > 0) {
      return `Existem ${pendingCount} pendencia(s) aberta(s) para acompanhamento do financeiro. O caixa pode seguir normalmente.`
    }

    if (activeTab.id === 'courier-withdrawal' && courierOptions.length === 0) {
      return 'Cadastre entregadores validos antes de registrar retiradas no caixa.'
    }

    return ''
  }, [
    activeTab.id,
    courierOptions.length,
    isFinancialPendingView,
    isCashOpen,
    openFinancialPendingRecords.length,
    pendingCount,
  ])

  useEffect(() => {
    if (isFinancialPendingView) {
      return
    }

    if (!isCashOpen && activeTab.id !== 'opening') {
      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams)
        nextParams.set('tab', 'opening')
        return nextParams
      })
      toast.warning('Abra o caixa primeiro')
      playWarning()
    }
  }, [activeTab.id, isCashOpen, isFinancialPendingView, setSearchParams, toast])

  useEffect(() => {
    if (!isCashOpen) {
      return
    }

    const nextBalance = Number((Number(cashState.initialBalance ?? 0) + balanceDelta).toFixed(2))

    if (Math.abs(nextBalance - Number(cashState.currentBalance ?? 0)) < 0.001) {
      return
    }

    const nextState = {
      ...cashState,
      currentBalance: nextBalance,
    }

    setCashState(nextState)
    saveCashState({
      storeId: currentStoreId,
      tenantId,
      storageKey: CASH_STATE_STORAGE_KEY,
      state: nextState,
      resetHour: CASH_RESET_HOUR,
    }).catch(() => {
      setSyncMessage('Historico local ativo')
    })
  }, [balanceDelta, cashState, currentStoreId, isCashOpen, tenantId])

  useEffect(() => {
    if (Number(cashState.pendingCount ?? 0) === pendingCount) {
      return
    }

    const nextState = {
      ...cashState,
      pendingCount,
    }

    setCashState(nextState)
    saveCashState({
      storeId: currentStoreId,
      tenantId,
      storageKey: CASH_STATE_STORAGE_KEY,
      state: nextState,
      resetHour: CASH_RESET_HOUR,
    }).catch(() => {
      setSyncMessage('Estado do caixa salvo localmente')
    })
  }, [cashState, currentStoreId, pendingCount, tenantId])

  const cashTabs = CASH_TABS

  const topMetrics = useMemo(() => {
    if (isFinancialPendingView) {
      return [
        {
          label: 'Pendencias abertas',
          value: String(openFinancialPendingRecords.length).padStart(2, '0'),
          meta: 'itens para acompanhamento',
        },
        {
          label: 'Resolvidas no dia',
          value: String(resolvedFinancialPendingRecords.length).padStart(2, '0'),
          meta: 'itens ja tratados',
        },
        {
          label: 'Valor em risco',
          value: formatCurrencyBRL(financialPendingAmount),
          meta: 'soma das abertas',
        },
      ]
    }

    return [
      {
        label: 'Movimentos do dia',
        value: String(records.length).padStart(2, '0'),
        meta: 'historico de caixa',
      },
      {
        label: activeTab.label,
        value: formatCurrencyBRL(totalAmountByTab[activeTab.id] ?? 0),
        meta: 'subtotal da aba',
      },
      {
        label: 'Total do dia',
        value: formatCurrencyBRL(totalDayAmount),
        meta: 'somatorio operacional',
      },
    ]
  }, [
    activeTab.id,
    activeTab.label,
    financialPendingAmount,
    isFinancialPendingView,
    openFinancialPendingRecords.length,
    records.length,
    resolvedFinancialPendingRecords.length,
    totalAmountByTab,
    totalDayAmount,
  ])

  const financialPendingHighlights = useMemo(() => {
    if (!isFinancialPendingView) {
      return []
    }

    const byPriority = openFinancialPendingRecords.reduce(
      (accumulator, record) => {
        const priority = record?.priority ?? 'medium'
        accumulator[priority] = (accumulator[priority] ?? 0) + 1
        return accumulator
      },
      { high: 0, medium: 0, low: 0 },
    )

    return [
      {
        label: 'Alta prioridade',
        value: String(byPriority.high).padStart(2, '0'),
        meta: 'pedem retorno mais rapido',
        tone: 'danger',
      },
      {
        label: 'Media prioridade',
        value: String(byPriority.medium).padStart(2, '0'),
        meta: 'acompanhar no fluxo do dia',
        tone: 'warning',
      },
      {
        label: 'Baixa prioridade',
        value: String(byPriority.low).padStart(2, '0'),
        meta: 'pendencias sem urgencia imediata',
        tone: 'neutral',
      },
      {
        label: 'Valor em aberto',
        value: formatCurrencyBRL(financialPendingAmount),
        meta: 'impacto financeiro pendente',
        tone: 'info',
      },
    ]
  }, [financialPendingAmount, isFinancialPendingView, openFinancialPendingRecords])

  function handleTabChange(tabId) {
    if (isFinancialPendingView) {
      return
    }

    if (tabId === 'opening' && isCashOpen) {
      toast.warning('O caixa ja foi aberto')
      playWarning()
    }

    if (tabId !== 'opening' && !isCashOpen) {
      toast.warning('Abra o caixa primeiro')
      playWarning()
      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams)
        nextParams.set('tab', 'opening')
        return nextParams
      })
      return
    }

    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      nextParams.set('tab', tabId)
      return nextParams
    })
    setErrorMessage('')
    setConfirmAction(null)
  }

  async function persistRecords(nextRecords, nextRecord = null) {
    const sortedRecords = sortRecords(nextRecords)
    setRecords(sortedRecords)
    saveResettableLocalRecords(CASH_STORAGE_KEY, sortedRecords, CASH_RESET_HOUR)

    if (!nextRecord) {
      return
    }

    try {
      const wasSavedRemotely = await saveManualModuleRecord({
        storeId: currentStoreId,
        tenantId,
        modulePath: 'cash',
        dailyResetHour: CASH_RESET_HOUR,
        record: nextRecord,
      })
      setSyncMessage(wasSavedRemotely ? '' : 'Historico local ativo')
    } catch (error) {
      console.error('Nao foi possivel sincronizar o lancamento de caixa.', error)
      setSyncMessage('Lancamento salvo localmente')
    }
  }

  async function persistFinancialPendingRecords(nextRecords, nextRecord = null) {
    const sortedRecords = sortFinancialPendingRecords(nextRecords)
    setFinancialPendingRecords(sortedRecords)
    saveResettableLocalRecords(FINANCIAL_PENDING_STORAGE_KEY, sortedRecords, CASH_RESET_HOUR)

    if (!nextRecord) {
      return
    }

    try {
      const wasSavedRemotely = await saveManualModuleRecord({
        storeId: currentStoreId,
        tenantId,
        modulePath: 'cash-financial-pending',
        dailyResetHour: CASH_RESET_HOUR,
        record: nextRecord,
      })
      setFinancialPendingSyncMessage(wasSavedRemotely ? '' : 'Pendencias financeiras em modo local')
    } catch (error) {
      console.error('Nao foi possivel sincronizar a pendencia financeira.', error)
      setFinancialPendingSyncMessage('Pendencia salva localmente')
    }
  }

  async function persistCashState(nextState) {
    setCashState(nextState)

    try {
      const wasSavedRemotely = await saveCashState({
        storeId: currentStoreId,
        tenantId,
        storageKey: CASH_STATE_STORAGE_KEY,
        state: nextState,
        resetHour: CASH_RESET_HOUR,
      })
      setSyncMessage(wasSavedRemotely ? '' : 'Historico local ativo')
    } catch (error) {
      console.error('Nao foi possivel sincronizar o estado do caixa.', error)
      setSyncMessage('Estado do caixa salvo localmente')
    }
  }

  function clearForm() {
    setSelectedCourier('')
    setValueInput('')
    setNote('')
    setErrorMessage('')
    setConfirmAction(null)
  }

  function clearFinancialPendingForm() {
    setFinancialPendingForm(initialFinancialPendingForm)
    setErrorMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (activeTab.id !== 'opening' && activeTab.id !== 'closing' && !isCashOpen) {
      toast.warning('Abra o caixa primeiro')
      playWarning()
      handleTabChange('opening')
      return
    }

    const amount = parseCurrencyInput(valueInput)

    if (activeTab.id !== 'closing' && amount <= 0) {
      setErrorMessage('Informe um valor maior que zero.')
      return
    }

    if (activeTab.id === 'opening' && isCashOpen) {
      setErrorMessage('O caixa ja esta aberto.')
      toast.warning('O caixa ja esta aberto')
      playWarning()
      return
    }

    if (requiresCourier && !selectedCourier.trim()) {
      setErrorMessage('Selecione o entregador da retirada.')
      return
    }

    const operatorName = session?.operatorName ?? session?.displayName ?? 'Operador local'

    if (activeTab.id === 'opening') {
      setConfirmAction({
        type: 'opening',
        message: `Abrir com ${formatCurrencyBRL(amount)}?`,
        amount,
        operatorName,
      })
      return
    }

    if (activeTab.id === 'closing') {
      if (!isCashOpen) {
        toast.warning('Abra o caixa primeiro')
        playWarning()
        handleTabChange('opening')
        return
      }

      setConfirmAction({
        type: 'closing',
        message: 'Confirmar fechamento de caixa?',
        amount: Number(cashState.currentBalance ?? 0),
        operatorName,
      })
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    const nextRecord = buildCashRecord(activeTab, amount, note, operatorName, selectedCourier)

    try {
      await persistRecords([nextRecord, ...records], nextRecord)
      appendAuditEvent({
        module: 'Caixa',
        modulePath: 'cash',
        actor: operatorName,
        action: activeTab.submitLabel,
        target: nextRecord.receiptCode,
        details: [
          nextRecord.amountLabel,
          nextRecord.courierName ? `Entregador: ${nextRecord.courierName}` : '',
          nextRecord.note ? `Obs: ${nextRecord.note}` : '',
        ]
          .filter(Boolean)
          .join(' | '),
      })
      clearForm()
      toast.success(`${activeTab.receiptLabel} registrado`)
      playCashSuccess()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleFinancialPendingSubmit(event) {
    event.preventDefault()

    const amount = parseCurrencyInput(financialPendingForm.amount)
    const operatorName = session?.operatorName ?? session?.displayName ?? 'Operador local'

    if (!financialPendingForm.customerName.trim()) {
      setErrorMessage('Informe o nome do cliente.')
      return
    }

    if (!financialPendingForm.customerPhone.trim()) {
      setErrorMessage('Informe o numero do cliente.')
      return
    }

    if (amount <= 0) {
      setErrorMessage('Informe um valor maior que zero.')
      return
    }

    if (!financialPendingForm.description.trim()) {
      setErrorMessage('Descreva a pendencia financeira.')
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    const nextRecord = buildFinancialPendingRecord(financialPendingForm, operatorName)

    try {
      await persistFinancialPendingRecords([nextRecord, ...financialPendingRecords], nextRecord)
      appendAuditEvent({
        module: 'Caixa',
        modulePath: 'cash',
        actor: operatorName,
        action: 'Registrou pendencia financeira',
        target: nextRecord.customerName,
        details: [
          nextRecord.typeLabel,
          nextRecord.amountLabel,
          `Numero: ${nextRecord.customerPhone}`,
          nextRecord.description,
        ].join(' | '),
      })
      clearFinancialPendingForm()
      toast.success('Pendencia financeira registrada')
      playCashSuccess()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction) {
      return
    }

    const operatorName = confirmAction.operatorName
    setIsSaving(true)
    setErrorMessage('')

    try {
      if (confirmAction.type === 'opening') {
        const openingTab = CASH_TABS.find((tab) => tab.id === 'opening')
        const nextRecord = buildCashRecord(openingTab, confirmAction.amount, '', operatorName)
        const nextState = {
          status: 'aberto',
          openedAt: new Date().toISOString(),
          closedAt: '',
          initialBalance: confirmAction.amount,
          currentBalance: confirmAction.amount,
          pendingCount: 0,
          operationalDay: cashState.operationalDay,
        }

        await persistRecords([nextRecord, ...records], nextRecord)
        await persistCashState(nextState)
        appendAuditEvent({
          module: 'Caixa',
          modulePath: 'cash',
          actor: operatorName,
          action: 'Abertura de caixa',
          target: nextRecord.receiptCode,
          details: nextRecord.amountLabel,
        })
        toast.success(
          `Caixa aberto as ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(nextState.openedAt))}`,
        )
        playCashSuccess()
        clearForm()
      }

      if (confirmAction.type === 'closing') {
        const closingTab = CASH_TABS.find((tab) => tab.id === 'closing')
        const nextRecord = buildCashRecord(closingTab, confirmAction.amount, note, operatorName)
        const nextState = {
          ...createDefaultCashState(CASH_RESET_HOUR),
          closedAt: new Date().toISOString(),
          currentBalance: confirmAction.amount,
        }

        await persistRecords([nextRecord, ...records], nextRecord)
        await persistCashState(nextState)
        appendAuditEvent({
          module: 'Caixa',
          modulePath: 'cash',
          actor: operatorName,
          action: 'Fechamento de caixa',
          target: nextRecord.receiptCode,
          details: nextRecord.amountLabel,
        })
        toast.success(
          `Caixa fechado as ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(nextState.closedAt))}`,
        )
        playCashSuccess()
        clearForm()
        navigate('/dashboard')
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(recordId) {
    const targetRecord = records.find((record) => record.id === recordId)
    const confirmed = await confirm.ask({
      title: 'Excluir lancamento',
      message: `Confirma a exclusao do lancamento ${targetRecord?.receiptCode ?? ''}?`,
      confirmLabel: 'Excluir lancamento',
      tone: 'danger',
    })

    if (!confirmed) {
      return
    }

    const nextRecords = records.filter((record) => record.id !== recordId)
    setRecords(nextRecords)
    saveResettableLocalRecords(CASH_STORAGE_KEY, nextRecords, CASH_RESET_HOUR)

    try {
      const wasDeletedRemotely = await deleteManualModuleRecord({
        storeId: currentStoreId,
        modulePath: 'cash',
        recordId,
      })
      setSyncMessage(wasDeletedRemotely ? '' : 'Historico local ativo')
    } catch (error) {
      console.error('Nao foi possivel remover o lancamento de caixa remotamente.', error)
      setSyncMessage('Exclusao mantida localmente')
    }

    appendAuditEvent({
      module: 'Caixa',
      modulePath: 'cash',
      actor: session?.operatorName ?? session?.displayName ?? 'Operador local',
      action: 'Excluiu lancamento',
      target: targetRecord?.receiptCode ?? 'Lancamento de caixa',
      details: targetRecord?.amountLabel ?? '',
    })
    toast.success('Lancamento excluido')
    playCashSuccess()
  }

  async function handleDeleteFinancialPending(recordId) {
    const targetRecord = financialPendingRecords.find((record) => record.id === recordId)
    const confirmed = await confirm.ask({
      title: 'Excluir pendencia',
      message: `Confirma a exclusao da pendencia de ${targetRecord?.customerName ?? 'cliente'}?`,
      confirmLabel: 'Excluir pendencia',
      tone: 'danger',
    })

    if (!confirmed) {
      return
    }

    const nextRecords = financialPendingRecords.filter((record) => record.id !== recordId)
    setFinancialPendingRecords(sortFinancialPendingRecords(nextRecords))
    saveResettableLocalRecords(FINANCIAL_PENDING_STORAGE_KEY, nextRecords, CASH_RESET_HOUR)

    try {
      const wasDeletedRemotely = await deleteManualModuleRecord({
        storeId: currentStoreId,
        modulePath: 'cash-financial-pending',
        recordId,
      })
      setFinancialPendingSyncMessage(wasDeletedRemotely ? '' : 'Pendencia removida no modo local')
    } catch (error) {
      console.error('Nao foi possivel remover a pendencia financeira remotamente.', error)
      setFinancialPendingSyncMessage('Pendencia removida no modo local')
    }

    appendAuditEvent({
      module: 'Caixa',
      modulePath: 'cash',
      actor: session?.operatorName ?? session?.displayName ?? 'Operador local',
      action: 'Excluiu pendencia financeira',
      target: targetRecord?.customerName ?? 'Pendencia financeira',
      details: targetRecord?.amountLabel ?? '',
    })
    toast.success('Pendencia excluida')
    playCashSuccess()
  }

  async function handleFinancialPendingChecklistToggle(recordId, checklistKey) {
    const targetRecord = financialPendingRecords.find((record) => record.id === recordId)

    if (!targetRecord) {
      return
    }

    const nextRecord = {
      ...targetRecord,
      checklist: {
        ...createDefaultFinancialPendingChecklist(),
        ...targetRecord.checklist,
        [checklistKey]: !targetRecord.checklist?.[checklistKey],
      },
      updatedAtClient: new Date().toISOString(),
    }
    const nextRecords = financialPendingRecords.map((record) =>
      record.id === recordId ? nextRecord : record,
    )

    await persistFinancialPendingRecords(nextRecords, nextRecord)
  }

  async function handleFinancialPendingResolvedToggle(recordId) {
    const targetRecord = financialPendingRecords.find((record) => record.id === recordId)

    if (!targetRecord) {
      return
    }

    const isResolved = isFinancialPendingResolved(targetRecord)

    if (!isResolved && !isFinancialPendingChecklistComplete(targetRecord)) {
      toast.warning('Conclua os checks antes de encerrar')
      playWarning()
      return
    }

    const operatorName = session?.operatorName ?? session?.displayName ?? 'Operador local'
    const nextRecord = {
      ...targetRecord,
      resolvedAtClient: isResolved ? '' : new Date().toISOString(),
      resolvedBy: isResolved ? '' : operatorName,
      updatedAtClient: new Date().toISOString(),
    }
    const nextRecords = financialPendingRecords.map((record) =>
      record.id === recordId ? nextRecord : record,
    )

    await persistFinancialPendingRecords(nextRecords, nextRecord)
    appendAuditEvent({
      module: 'Caixa',
      modulePath: 'cash',
      actor: operatorName,
      action: isResolved ? 'Reabriu pendencia financeira' : 'Concluiu pendencia financeira',
      target: targetRecord.customerName,
      details: [targetRecord.typeLabel, targetRecord.amountLabel].join(' | '),
    })
    toast.success(isResolved ? 'Pendencia reaberta' : 'Pendencia concluida')
    playCashSuccess()
  }

  async function handleClearResolvedFinancialPendings() {
    const resolvedIds = resolvedFinancialPendingRecords.map((record) => record.id)

    if (resolvedIds.length === 0) {
      return
    }

    const confirmed = await confirm.ask({
      title: 'Limpar resolvidas',
      message: `Confirma remover ${resolvedIds.length} pendencia(s) ja resolvida(s)?`,
      confirmLabel: 'Limpar resolvidas',
      tone: 'danger',
    })

    if (!confirmed) {
      return
    }

    const nextRecords = financialPendingRecords.filter((record) => !resolvedIds.includes(record.id))
    setFinancialPendingRecords(sortFinancialPendingRecords(nextRecords))
    saveResettableLocalRecords(FINANCIAL_PENDING_STORAGE_KEY, nextRecords, CASH_RESET_HOUR)

    try {
      await Promise.all(
        resolvedIds.map((recordId) =>
          deleteManualModuleRecord({
            storeId: currentStoreId,
            modulePath: 'cash-financial-pending',
            recordId,
          }),
        ),
      )
      setFinancialPendingSyncMessage('')
    } catch (error) {
      console.error('Nao foi possivel limpar pendencias resolvidas remotamente.', error)
      setFinancialPendingSyncMessage('Limpeza mantida no modo local')
    }

    appendAuditEvent({
      module: 'Caixa',
      modulePath: 'cash',
      actor: session?.operatorName ?? session?.displayName ?? 'Operador local',
      action: 'Limpou pendencias financeiras resolvidas',
      target: 'Pendencias financeiras',
      details: `${resolvedIds.length} registro(s) removido(s)`,
    })
    toast.success('Pendencias resolvidas removidas')
    playCashSuccess()
  }

  async function handleExportFinancialPendingsImage() {
    const exportNode = document.getElementById('financial-pending-export-canvas')

    if (!exportNode) {
      toast.error('Nao foi possivel preparar a exportacao.')
      return
    }

    try {
      const image = await toPng(exportNode, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#f7fafc',
        skipFonts: true,
      })
      const fileDate = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
        .format(new Date())
        .replace(/\//g, '-')
      const link = document.createElement('a')

      link.href = image
      link.download = `pendencias-financeiras-${fileDate}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()

      toast.success('Imagem exportada')
    } catch (error) {
      console.error('Nao foi possivel exportar as pendencias financeiras.', error)
      toast.error('Falha ao exportar a imagem')
    }
  }

  async function handleClearHistory() {
    const confirmed = await confirm.ask({
      title: 'Limpar historico',
      message: 'Confirma a limpeza do historico operacional do caixa neste dia?',
      confirmLabel: 'Limpar historico',
      tone: 'danger',
    })

    if (!confirmed) {
      return
    }

    setRecords([])
    saveResettableLocalRecords(CASH_STORAGE_KEY, [], CASH_RESET_HOUR)

    try {
      const wasClearedRemotely = await clearManualModuleRecords({
        storeId: currentStoreId,
        modulePath: 'cash',
        storageKey: CASH_STORAGE_KEY,
        initialRecords: [],
        dailyResetHour: CASH_RESET_HOUR,
      })
      setSyncMessage(wasClearedRemotely ? '' : 'Historico limpo localmente')
    } catch (error) {
      console.error('Nao foi possivel limpar o historico remoto do caixa.', error)
      setSyncMessage('Historico limpo localmente')
    }

    appendAuditEvent({
      module: 'Caixa',
      modulePath: 'cash',
      actor: session?.operatorName ?? session?.displayName ?? 'Operador local',
      action: 'Limpou historico do dia',
      target: 'Caixa',
      details: 'Historico operacional do dia foi reiniciado.',
    })
    toast.success('Historico do caixa limpo')
    playCashSuccess()
  }

  return (
    <div className="cash-module">
      {isFinancialPendingView ? null : (
        <CaixaStatusBar
          cashState={cashState}
          onOpenCash={() => handleTabChange('opening')}
          onGoToClosing={() => handleTabChange('closing')}
          closingDisabled={closingDisabled}
          closingTooltip={
            pendingCount > 0 ? `${pendingCount} pendencia(s) aberta(s) para acompanhamento` : ''
          }
        />
      )}

      <div className="card-grid cash-module__metrics">
        {topMetrics.map((metric) => (
          <CashMetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            meta={metric.meta}
          />
        ))}
      </div>

      {isFinancialPendingView ? null : (
        <PageTabs tabs={cashTabs} activeTab={activeTab.id} onTabChange={handleTabChange} />
      )}

      <SurfaceCard title={activeTab.title}>
        {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}
        {openingBlockedMessage ? (
          <div className="cash-module__inline-warning">{openingBlockedMessage}</div>
        ) : null}
        {activeTabGuardrailMessage ? (
          <div className="cash-module__inline-state">{activeTabGuardrailMessage}</div>
        ) : null}
        {isFinancialPendingView ? (
          financialPendingSyncMessage ? (
            <div className="cash-module__sync-note">{financialPendingSyncMessage}</div>
          ) : null
        ) : syncMessage ? (
          <div className="cash-module__sync-note">{syncMessage}</div>
        ) : null}

        {isFinancialPendingView ? (
          <form className="cash-module__pending-form" onSubmit={handleFinancialPendingSubmit}>
            <FormRow className="cash-module__form-row cash-module__pending-form-grid">
              <div className="ui-field cash-module__row-field">
                <label className="ui-label" htmlFor="financial-pending-customer">
                  Cliente
                </label>
                <input
                  id="financial-pending-customer"
                  className="ui-input"
                  placeholder="Nome do cliente"
                  value={financialPendingForm.customerName}
                  onChange={(event) =>
                    setFinancialPendingForm((current) => ({
                      ...current,
                      customerName: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="ui-field cash-module__row-field cash-module__row-field--value">
                <label className="ui-label" htmlFor="financial-pending-phone">
                  Numero
                </label>
                <input
                  id="financial-pending-phone"
                  className="ui-input"
                  placeholder="Telefone / WhatsApp"
                  value={financialPendingForm.customerPhone}
                  onChange={(event) =>
                    setFinancialPendingForm((current) => ({
                      ...current,
                      customerPhone: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="ui-field cash-module__row-field cash-module__row-field--value">
                <label className="ui-label" htmlFor="financial-pending-type">
                  Tipo
                </label>
                <Select
                  id="financial-pending-type"
                  value={financialPendingForm.type}
                  onChange={(event) =>
                    setFinancialPendingForm((current) => ({ ...current, type: event.target.value }))
                  }
                >
                  {FINANCIAL_PENDING_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="ui-field cash-module__row-field cash-module__row-field--value">
                <label className="ui-label" htmlFor="financial-pending-priority">
                  Prioridade
                </label>
                <Select
                  id="financial-pending-priority"
                  value={financialPendingForm.priority}
                  onChange={(event) =>
                    setFinancialPendingForm((current) => ({
                      ...current,
                      priority: event.target.value,
                    }))
                  }
                >
                  {FINANCIAL_PENDING_PRIORITIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="ui-field cash-module__row-field cash-module__row-field--value">
                <label className="ui-label" htmlFor="financial-pending-value">
                  Valor
                </label>
                <input
                  id="financial-pending-value"
                  className="ui-input"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={financialPendingForm.amount}
                  onChange={(event) =>
                    setFinancialPendingForm((current) => ({
                      ...current,
                      amount: formatCurrencyInput(event.target.value),
                    }))
                  }
                />
              </div>
            </FormRow>

            <div className="ui-field">
              <label className="ui-label" htmlFor="financial-pending-description">
                Descricao
              </label>
              <textarea
                id="financial-pending-description"
                className="ui-textarea"
                placeholder="Explique o problema: troco nao entregue, estorno em aberto, cobranca divergente..."
                value={financialPendingForm.description}
                onChange={(event) =>
                  setFinancialPendingForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>

            <div className="cash-module__confirm">
              <div className="cash-module__confirm-copy">
                <strong>Checklist operacional para encerrar</strong>
                <span>
                  Quando a pendencia for registrada, ela so podera ser concluida depois dos 3
                  checks: cliente contatado, valor conferido e acao executada.
                </span>
              </div>
              <div className="cash-module__form-actions">
                <Button variant="secondary" onClick={clearFinancialPendingForm}>
                  Limpar
                </Button>
                <Button type="submit" variant="primary" disabled={isSaving}>
                  Registrar pendencia
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <form
            className={`cash-module__form cash-module__form--${activeTab.id}`}
            onSubmit={handleSubmit}
          >
            {activeTab.id === 'closing' ? (
              <div className="cash-module__closing-summary">
                <div className="cash-module__closing-row">
                  <span>Entradas</span>
                  <strong>
                    {formatCurrencyBRL(
                      (totalAmountByTab.opening ?? 0) + (totalAmountByTab.supply ?? 0),
                    )}
                  </strong>
                </div>
                <div className="cash-module__closing-row">
                  <span>Saidas</span>
                  <strong>
                    {formatCurrencyBRL(
                      (totalAmountByTab.withdrawal ?? 0) +
                        (totalAmountByTab['courier-withdrawal'] ?? 0),
                    )}
                  </strong>
                </div>
                <div className="cash-module__closing-row cash-module__closing-row--total">
                  <span>Saldo final</span>
                  <strong>{formatCurrencyBRL(cashState.currentBalance ?? 0)}</strong>
                </div>
              </div>
            ) : (
              <FormRow className="cash-module__form-row">
                {requiresCourier ? (
                  <div className="ui-field cash-module__row-field cash-module__row-field--courier">
                    <label className="ui-label" htmlFor="cash-courier">
                      Entregador
                    </label>
                    <Select
                      id="cash-courier"
                      className="ui-select"
                      value={selectedCourier}
                      disabled={courierOptions.length === 0}
                      onChange={(event) => setSelectedCourier(event.target.value)}
                    >
                      <option value="">Selecione o entregador</option>
                      {courierOptions.map((courierName) => (
                        <option key={courierName} value={courierName}>
                          {courierName}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}

                <div className="ui-field cash-module__row-field cash-module__row-field--value">
                  <label className="ui-label" htmlFor="cash-value">
                    Valor
                  </label>
                  <input
                    id="cash-value"
                    className="ui-input"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={valueInput}
                    onChange={(event) => setValueInput(formatCurrencyInput(event.target.value))}
                  />
                </div>

                {activeTab.id !== 'opening' ? (
                  <div className="ui-field cash-module__row-field cash-module__row-field--note">
                    <label className="ui-label" htmlFor="cash-note">
                      Observacao
                    </label>
                    <input
                      id="cash-note"
                      className="ui-input"
                      placeholder="Observacao"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </div>
                ) : null}

                <Button variant="secondary" onClick={clearForm}>
                  Limpar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={
                    isSaving ||
                    (activeTab.id !== 'opening' && !isCashOpen) ||
                    (activeTab.id === 'opening' && isCashOpen) ||
                    (activeTab.id === 'courier-withdrawal' && courierOptions.length === 0)
                  }
                  title={
                    activeTab.id === 'opening' && isCashOpen
                      ? 'O caixa ja foi aberto para este turno'
                      : activeTab.id === 'courier-withdrawal' && courierOptions.length === 0
                        ? 'Cadastre entregadores antes de registrar retiradas'
                        : undefined
                  }
                >
                  {activeTab.submitLabel}
                </Button>
              </FormRow>
            )}

            {confirmAction ? (
              <div className="cash-module__confirm">
                <div className="cash-module__confirm-copy">
                  <strong>{confirmAction.message}</strong>
                  {confirmAction.type === 'closing' ? (
                    <span>
                      Resumo visivel acima. O fechamento nao podera ser desfeito no turno atual.
                    </span>
                  ) : null}
                </div>
                <div className="cash-module__form-actions">
                  <Button type="button" variant="secondary" onClick={() => setConfirmAction(null)}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleConfirmAction}
                    disabled={isSaving}
                  >
                    Confirmar
                  </Button>
                </div>
              </div>
            ) : null}
          </form>
        )}
      </SurfaceCard>

      {isFinancialPendingView ? (
        <SurfaceCard title="Fila de pendencias financeiras">
          <div className="cash-module__pending-highlights">
            {financialPendingHighlights.map((item) => (
              <article
                key={item.label}
                className={`cash-module__pending-highlight cash-module__pending-highlight--${item.tone}`}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.meta}</small>
              </article>
            ))}
          </div>

          <div className="cash-module__history-toolbar">
            <span className="cash-module__history-counter">
              {`${filteredFinancialPendingRecords.length} visiveis - ${financialPendingRecords.length} no dia`}
            </span>

            <div className="cash-module__history-toolbar-actions">
              <input
                className="ui-input cash-module__pending-search"
                placeholder="Buscar cliente, numero ou descricao"
                value={financialPendingSearch}
                onChange={(event) => setFinancialPendingSearch(event.target.value)}
              />
              <Select
                value={financialPendingFilter}
                onChange={(event) => setFinancialPendingFilter(event.target.value)}
              >
                <option value="open">Abertas</option>
                <option value="resolved">Resolvidas</option>
                <option value="all">Todas</option>
              </Select>
              <Button variant="secondary" onClick={handleExportFinancialPendingsImage}>
                Exportar imagem
              </Button>
              {resolvedFinancialPendingRecords.length > 0 ? (
                <Button variant="secondary" onClick={handleClearResolvedFinancialPendings}>
                  Limpar resolvidas
                </Button>
              ) : null}
            </div>
          </div>

          <FinancialPendingTable
            records={filteredFinancialPendingRecords}
            onChecklistToggle={handleFinancialPendingChecklistToggle}
            onResolvedToggle={handleFinancialPendingResolvedToggle}
            onDelete={handleDeleteFinancialPending}
          />
        </SurfaceCard>
      ) : (
        <SurfaceCard title="Historico de caixa">
          <div className="cash-module__history-toolbar">
            <span className="cash-module__history-counter">
              {`${records.length} visiveis - ${records.length} no dia`}
            </span>

            <div className="cash-module__history-toolbar-actions">
              <Link to="/history?modulo=cash&data=hoje" className="native-module__history-link">
                Ver historico do caixa
              </Link>
              {records.length > 0 ? (
                <Button variant="secondary" onClick={handleClearHistory}>
                  Limpar historico
                </Button>
              ) : null}
            </div>
          </div>

          <CashHistoryTable records={records} onPrint={printCashReceipt} onDelete={handleDelete} />
        </SurfaceCard>
      )}

      {isFinancialPendingView ? (
        <div className="cash-module__pending-export-canvas" aria-hidden="true">
          <div id="financial-pending-export-canvas">
            <FinancialPendingExportCanvas
              records={filteredFinancialPendingRecords}
              totalOpenAmount={financialPendingAmount}
              session={session}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default CashModule
