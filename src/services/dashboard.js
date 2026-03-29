import { loadCashState } from './cashStateService'
import {
  getFinanceEntryDirection,
  isFinanceEntryActive,
  subscribeToFinancialEntries,
} from './finance'
import { isOrderClosedStatus, isSalePosted } from './commerce'
import { canUseRemoteSync, firebaseReady } from './firebase'
import { subscribeToInventoryItems } from './inventory'
import { loadLocalRecords, loadResettableLocalRecords } from './localAccess'
import { courierSeedRecords } from './operationsSeedData'
import { subscribeToOrders } from './orders'
import { subscribeToSales } from './sales'

const delayedOrderThresholdMinutes = 35
const CASH_STATE_STORAGE_KEY = 'nexus-module-cash-state'
const FINANCIAL_PENDING_STORAGE_KEY = 'nexus-module-cash-financial-pending'
const DELIVERY_READING_STORAGE_KEY = 'nexus-module-delivery-reading'

function asDate(value) {
  if (!value) {
    return null
  }

  return typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
}

function parseMoney(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(parseMoney(value))
}

function formatInteger(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value ?? 0))
}

function formatPercent(value, digits = 0) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return '--'
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(parsed / 100)
}

function formatHourLabel(hour) {
  return `${String(hour).padStart(2, '0')}h`
}

function getScheduleEntryTime(value) {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .split('-')[0]
    .trim()
}

function summarizeProductName(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length <= 3) {
    return words.join(' ')
  }

  return `${words.slice(0, 3).join(' ')}...`
}

function toSentenceCase(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

  if (!normalized) {
    return 'Produto'
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function buildDateLabel(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function formatDateTime(value) {
  const dateValue = asDate(value)

  if (!dateValue) {
    return 'Sem registro'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateValue)
}

function getDayKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isWithinPeriod(value, startDate, endDate) {
  const dateValue = asDate(value)

  if (!dateValue) {
    return false
  }

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`)
    if (dateValue < start) {
      return false
    }
  }

  if (endDate) {
    const end = new Date(`${endDate}T23:59:59`)
    if (dateValue > end) {
      return false
    }
  }

  return true
}

function isOrderDelayed(order) {
  const createdAt = asDate(order.createdAt)

  if (!createdAt || isOrderClosedStatus(order.domainStatus ?? order.status)) {
    return false
  }

  return (Date.now() - createdAt.getTime()) / 60000 >= delayedOrderThresholdMinutes
}

function getStatusBadgeClass(status) {
  const normalized = String(status ?? '').toLowerCase()

  if (normalized.includes('rota')) {
    return 'ui-badge--info'
  }

  if (normalized.includes('reserva')) {
    return 'ui-badge--special'
  }

  if (normalized.includes('pendente')) {
    return 'ui-badge--warning'
  }

  return 'ui-badge--success'
}

function shouldHighlightAdvanceReminder(now = new Date()) {
  const start = new Date(now)
  start.setHours(22, 30, 0, 0)

  return now >= start
}

function getShiftLabel(now = new Date()) {
  const hour = now.getHours()

  if (hour < 6) {
    return 'Madrugada'
  }

  if (hour < 12) {
    return 'Manha'
  }

  if (hour < 18) {
    return 'Tarde'
  }

  return 'Noite'
}

function buildPeriodLabel(startDate, endDate) {
  if (!startDate || !endDate) {
    return 'Periodo atual'
  }

  if (startDate === endDate) {
    return buildDateLabel(new Date(`${startDate}T00:00:00`))
  }

  return `${buildDateLabel(new Date(`${startDate}T00:00:00`))} - ${buildDateLabel(new Date(`${endDate}T00:00:00`))}`
}

function normalizeRate(part, total) {
  if (!total) {
    return null
  }

  return (part / total) * 100
}

function hasResolvedFinancialPending(record) {
  return Boolean(record?.resolvedAtClient)
}

function matchesChannel(record, targetChannel) {
  const normalizedTarget = String(targetChannel ?? '')
    .trim()
    .toUpperCase()
  const candidates = [record?.channel, record?.source, record?.origin, record?.sourceChannel]
    .map((value) =>
      String(value ?? '')
        .trim()
        .toUpperCase(),
    )
    .filter(Boolean)

  return candidates.some((candidate) => candidate === normalizedTarget)
}

function buildDailySalesSeries(sales, startDate, endDate) {
  const start = startDate ? new Date(`${startDate}T00:00:00`) : new Date()
  const end = endDate ? new Date(`${endDate}T23:59:59`) : new Date()
  const dates = []
  const cursor = new Date(start)

  while (cursor <= end && dates.length < 14) {
    dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  if (dates.length === 0) {
    dates.push(new Date())
  }

  const totalsByDay = sales.reduce((accumulator, sale) => {
    const saleDate = asDate(sale.createdAt)

    if (!saleDate) {
      return accumulator
    }

    const dayKey = getDayKey(saleDate)
    accumulator.set(dayKey, (accumulator.get(dayKey) ?? 0) + parseMoney(sale.total))
    return accumulator
  }, new Map())

  return dates.map((date) => ({
    label: buildDateLabel(date),
    value: Number((totalsByDay.get(getDayKey(date)) ?? 0).toFixed(2)),
  }))
}

function buildHourlyOrdersSeries(orders, sales) {
  const source = orders.length > 0 ? orders : sales
  const countsByHour = source.reduce((accumulator, item) => {
    const dateValue = asDate(item.createdAt)

    if (!dateValue) {
      return accumulator
    }

    const hour = dateValue.getHours()
    accumulator.set(hour, (accumulator.get(hour) ?? 0) + 1)
    return accumulator
  }, new Map())

  const populatedHours = Array.from(countsByHour.entries()).sort(
    (left, right) => left[0] - right[0],
  )

  const selectedHours =
    populatedHours.length > 0
      ? populatedHours.slice(Math.max(populatedHours.length - 8, 0))
      : [[new Date().getHours(), 0]]

  return selectedHours.map(([hour, value]) => ({
    label: formatHourLabel(hour),
    value,
  }))
}

function buildReminder({ id, type, title, message, route }) {
  return { id, type, title, message, route }
}

export function getDefaultDashboardPeriod() {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - 6)

  return {
    startDate: getDayKey(startDate),
    endDate: getDayKey(endDate),
  }
}

export function loadDashboardOperationalSources() {
  const scheduleRecords = loadResettableLocalRecords('nexus-module-schedule', [], 3)
  const machineChecklist = loadResettableLocalRecords('nexus-module-machine-history', [], 3)
  const changeRecords = loadResettableLocalRecords('nexus-module-change', [], 3)
  const advanceRecords = loadResettableLocalRecords('nexus-module-advances', [], 3)
  const occurrenceRecords = loadResettableLocalRecords('nexus-module-occurrences', [], 3)
  const courierRecords = loadLocalRecords('nexus-manual-couriers', courierSeedRecords)
  const deliveryReadingRecords = loadResettableLocalRecords(DELIVERY_READING_STORAGE_KEY, [], 3)
  const financialPendingRecords = loadLocalRecords(FINANCIAL_PENDING_STORAGE_KEY, [])
  const cashState = loadCashState(CASH_STATE_STORAGE_KEY, 3)

  return {
    scheduleRecords,
    machineChecklist,
    changeRecords,
    advanceRecords,
    occurrenceRecords,
    courierRecords,
    deliveryReadingRecords,
    financialPendingRecords,
    cashState,
  }
}

export function subscribeToDashboardSources(storeId, handlers) {
  if (!firebaseReady || !storeId || !canUseRemoteSync()) {
    handlers.onSales?.([])
    handlers.onOrders?.([])
    handlers.onInventoryItems?.([])
    handlers.onFinancialEntries?.([])
    return () => {}
  }

  const unsubscribers = []

  unsubscribers.push(subscribeToSales(storeId, handlers.onSales, handlers.onError))
  unsubscribers.push(
    subscribeToInventoryItems(storeId, handlers.onInventoryItems, handlers.onError),
  )
  unsubscribers.push(
    subscribeToFinancialEntries(storeId, handlers.onFinancialEntries, handlers.onError),
  )
  unsubscribers.push(subscribeToOrders(storeId, handlers.onOrders, handlers.onError))

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe?.())
  }
}

export function buildDashboardData({
  storeId,
  sales = [],
  orders = [],
  financialEntries = [],
  inventoryItems = [],
  startDate,
  endDate,
  operations = {},
  integrations = {},
}) {
  const now = new Date()
  const completedSales = sales.filter(
    (sale) =>
      isSalePosted(sale.domainStatus ?? sale.status) &&
      isWithinPeriod(sale.createdAt, startDate, endDate),
  )
  const ordersInPeriod = orders.filter((order) =>
    isWithinPeriod(order.createdAt, startDate, endDate),
  )
  const openOrders = ordersInPeriod.filter(
    (order) => !isOrderClosedStatus(order.domainStatus ?? order.status),
  )
  const delayedOrders = ordersInPeriod.filter(isOrderDelayed)
  const completedOrders = ordersInPeriod.filter((order) =>
    isOrderClosedStatus(order.domainStatus ?? order.status),
  )
  const activeEntries = financialEntries.filter(
    (entry) => isWithinPeriod(entry.createdAt, startDate, endDate) && isFinanceEntryActive(entry),
  )

  const totalSold = completedSales.reduce((total, sale) => total + parseMoney(sale.total), 0)
  const totalSalesCount = completedSales.length
  const averageTicket = totalSalesCount > 0 ? totalSold / totalSalesCount : 0
  const totalIncome = activeEntries
    .filter((entry) => getFinanceEntryDirection(entry) === 'entrada')
    .reduce((total, entry) => total + parseMoney(entry.amount), 0)
  const totalExpense = activeEntries
    .filter((entry) => getFinanceEntryDirection(entry) === 'saida')
    .reduce((total, entry) => total + parseMoney(entry.amount), 0)
  const lowStockItems = inventoryItems.filter(
    (item) => Number(item.currentStock ?? 0) <= Number(item.minimumStock ?? 0),
  )

  const scheduleRecords = operations.scheduleRecords ?? []
  const machineChecklist = operations.machineChecklist ?? []
  const changeRecords = operations.changeRecords ?? []
  const advanceRecords = operations.advanceRecords ?? []
  const occurrenceRecords = operations.occurrenceRecords ?? []
  const courierRecords = operations.courierRecords ?? []
  const deliveryReadingRecords = operations.deliveryReadingRecords ?? []
  const financialPendingRecords = operations.financialPendingRecords ?? []
  const cashState = operations.cashState ?? {
    status: 'fechado',
    currentBalance: 0,
    initialBalance: 0,
    pendingCount: 0,
  }

  const openFinancialPendings = financialPendingRecords.filter(
    (record) => !hasResolvedFinancialPending(record),
  )
  const highPriorityFinancialPendings = openFinancialPendings.filter(
    (record) => record.priority === 'high',
  )
  const openFinancialPendingAmount = openFinancialPendings.reduce(
    (total, record) => total + parseMoney(record.amount),
    0,
  )

  const activeCouriers = scheduleRecords.filter((record) => record.status !== 'Pendente')
  const registeredCouriers = courierRecords.length
  const openChanges = changeRecords.filter((record) => record.status !== 'Retornou').length
  const openAdvances = advanceRecords.filter((record) => record.status !== 'Baixado').length
  const openOccurrences = occurrenceRecords.filter(
    (record) => record.status !== 'Resolvida' && record.status !== 'Fechada',
  ).length
  const uncheckedMachines = machineChecklist.filter((record) => record.status !== 'Presente').length
  const closedDeliveryReadings = deliveryReadingRecords.filter((record) => Boolean(record.closed))
  const openDeliveryReadings = deliveryReadingRecords.filter((record) => !record.closed)
  const turboDeliveries = deliveryReadingRecords.filter((record) => Boolean(record.turbo))

  const productsMap = new Map()
  completedSales.forEach((sale) => {
    sale.items?.forEach((item) => {
      const itemName = item.productSnapshot?.name ?? item.name
      const currentItem = productsMap.get(item.productId ?? itemName) ?? {
        id: item.productId ?? itemName,
        name: itemName,
        quantity: 0,
        revenue: 0,
      }

      currentItem.quantity += Number(item.quantity ?? 0)
      currentItem.revenue += parseMoney(item.totalPrice ?? item.total)
      productsMap.set(currentItem.id, currentItem)
    })
  })

  const topProducts = Array.from(productsMap.values())
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 5)

  const externalIfoodOrders = ordersInPeriod.filter((order) => matchesChannel(order, 'IFOOD'))
  const externalZeOrders = ordersInPeriod.filter((order) => matchesChannel(order, 'ZE_DELIVERY'))
  const ifoodMerchants = integrations.ifoodMerchants ?? []
  const zeDeliveryStore = integrations.zeDeliveryStore ?? null
  const zeStats24h = zeDeliveryStore?.stats24h ?? null
  const zeSuccessRate =
    zeStats24h?.totalRuns != null
      ? Math.max(0, 100 - Number(zeStats24h.failureRate ?? 0))
      : (integrations.zeDeliverySummary?.successRate ?? null)
  const zeLastSyncSuccess = zeDeliveryStore?.status?.lastSyncSuccess
  const integrationIssueCount =
    (zeStats24h?.errors ?? integrations.zeDeliverySummary?.errorCount ?? 0) +
    (integrations.integrationError ? 1 : 0)
  const iFoodConfiguredCount = ifoodMerchants.length
  const orderCompletionRate = normalizeRate(completedOrders.length, ordersInPeriod.length) ?? 0
  const totalOperationalRisks =
    delayedOrders.length +
    openOccurrences +
    highPriorityFinancialPendings.length +
    openChanges +
    integrationIssueCount
  const shouldShowAdvancesReminder = openAdvances > 0 && shouldHighlightAdvanceReminder(now)
  const periodLabel = buildPeriodLabel(startDate, endDate)
  const shiftLabel = getShiftLabel(now)
  const storeLabel = storeId ? `Loja ${storeId}` : 'Loja ativa'

  const reminders = []

  if (delayedOrders.length > 0) {
    reminders.push(
      buildReminder({
        id: 'orders-delayed',
        type: 'danger',
        title:
          delayedOrders.length === 1
            ? '1 pedido fora da janela'
            : `${formatInteger(delayedOrders.length)} pedidos fora da janela`,
        message: 'Priorize pedidos travados para reduzir fila e impacto no turno.',
        route: '/orders',
      }),
    )
  }

  if (highPriorityFinancialPendings.length > 0) {
    reminders.push(
      buildReminder({
        id: 'financial-pending-high',
        type: 'warning',
        title:
          highPriorityFinancialPendings.length === 1
            ? '1 pendencia financeira critica'
            : `${formatInteger(highPriorityFinancialPendings.length)} pendencias financeiras criticas`,
        message: 'Ha valor em risco e casos de cliente aguardando retorno do financeiro.',
        route: '/financial-pendings',
      }),
    )
  }

  if (openOccurrences > 0) {
    reminders.push(
      buildReminder({
        id: 'occurrences-open',
        type: 'warning',
        title:
          openOccurrences === 1
            ? '1 ocorrencia em tratamento'
            : `${formatInteger(openOccurrences)} ocorrencias em tratamento`,
        message: 'Ocorrencias abertas continuam pressionando a operacao do turno.',
        route: '/occurrences',
      }),
    )
  }

  if (uncheckedMachines > 0) {
    reminders.push(
      buildReminder({
        id: 'machines-unchecked',
        type: 'info',
        title:
          uncheckedMachines === 1
            ? '1 maquininha sem checklist'
            : `${formatInteger(uncheckedMachines)} maquininhas sem checklist`,
        message: 'Feche a checagem do parque para evitar falhas na rua.',
        route: '/machine-history',
      }),
    )
  }

  if (lowStockItems.length > 0) {
    reminders.push(
      buildReminder({
        id: 'low-stock',
        type: 'warning',
        title:
          lowStockItems.length === 1
            ? '1 item abaixo do minimo'
            : `${formatInteger(lowStockItems.length)} itens abaixo do minimo`,
        message: 'Reposicao imediata reduz risco de ruptura no atendimento.',
        route: '/inventory',
      }),
    )
  }

  if (zeLastSyncSuccess === false || integrationIssueCount > 0) {
    reminders.push(
      buildReminder({
        id: 'integrations-unstable',
        type: 'danger',
        title: 'Integracoes exigem atencao',
        message: 'O monitoramento detectou erro recente em sincronizacao externa.',
        route: '/integrations/ze-delivery',
      }),
    )
  }

  if (shouldShowAdvancesReminder) {
    reminders.push(
      buildReminder({
        id: 'advances-open',
        type: 'warning',
        title:
          openAdvances === 1
            ? 'Existe 1 vale em aberto'
            : `Existem ${formatInteger(openAdvances)} vales em aberto`,
        message: 'Desconte do entregador antes do fechamento do turno.',
        route: '/advances',
      }),
    )
  }

  return {
    kpis: [
      {
        id: 'orders',
        label: 'Pedidos no recorte',
        value: formatInteger(ordersInPeriod.length),
        meta: `${formatInteger(openOrders.length)} em aberto - ${formatInteger(delayedOrders.length)} atrasados`,
        badgeText: delayedOrders.length > 0 ? 'atencao' : 'fluxo',
        badgeClass: delayedOrders.length > 0 ? 'ui-badge--warning' : 'ui-badge--success',
        tone: delayedOrders.length > 0 ? 'amber' : 'green',
      },
      {
        id: 'sales',
        label: 'Vendas faturadas',
        value: formatCurrency(totalSold),
        meta: `${formatInteger(totalSalesCount)} vendas - ticket ${formatCurrency(averageTicket)}`,
        badgeText: 'comercial',
        badgeClass: 'ui-badge--info',
        tone: 'blue',
      },
      {
        id: 'cash',
        label: 'Caixa do turno',
        value: formatCurrency(cashState.currentBalance),
        meta: cashState.status === 'aberto' ? 'caixa aberto' : 'caixa fechado',
        badgeText: cashState.status === 'aberto' ? 'ao vivo' : 'fechado',
        badgeClass: cashState.status === 'aberto' ? 'ui-badge--success' : 'ui-badge--neutral',
        tone: cashState.status === 'aberto' ? 'green' : 'blue',
      },
      {
        id: 'financial-pendings',
        label: 'Pendencias financeiras',
        value: formatCurrency(openFinancialPendingAmount),
        meta: `${formatInteger(openFinancialPendings.length)} abertas - ${formatInteger(highPriorityFinancialPendings.length)} alta prioridade`,
        badgeText: highPriorityFinancialPendings.length > 0 ? 'critico' : 'controle',
        badgeClass:
          highPriorityFinancialPendings.length > 0 ? 'ui-badge--danger' : 'ui-badge--info',
        tone: highPriorityFinancialPendings.length > 0 ? 'red' : 'blue',
      },
      {
        id: 'operational-risk',
        label: 'Falhas operacionais',
        value: formatInteger(totalOperationalRisks),
        meta: `${formatInteger(openOccurrences)} ocorrencias - ${formatInteger(uncheckedMachines)} checks pendentes`,
        badgeText: totalOperationalRisks > 0 ? 'acao' : 'ok',
        badgeClass: totalOperationalRisks > 0 ? 'ui-badge--danger' : 'ui-badge--success',
        variant: totalOperationalRisks > 0 ? 'danger' : 'neutral',
        pulse: totalOperationalRisks > 0,
        tone: totalOperationalRisks > 0 ? 'red' : 'green',
      },
      {
        id: 'couriers',
        label: 'Entregadores ativos',
        value: formatInteger(activeCouriers.length),
        meta: `${formatInteger(closedDeliveryReadings.length)} leituras fechadas - ${formatInteger(registeredCouriers)} cadastrados`,
        badgeText: 'escala',
        badgeClass: 'ui-badge--info',
        tone: 'blue',
      },
      {
        id: 'integrations',
        label: 'Integracoes',
        value:
          zeSuccessRate != null
            ? formatPercent(zeSuccessRate, 0)
            : formatInteger(iFoodConfiguredCount),
        meta: `Ze ${zeLastSyncSuccess === false ? 'instavel' : 'monitorado'} - iFood ${formatInteger(iFoodConfiguredCount)} loja(s)`,
        badgeText: integrationIssueCount > 0 ? 'instavel' : 'ok',
        badgeClass: integrationIssueCount > 0 ? 'ui-badge--warning' : 'ui-badge--success',
        tone: integrationIssueCount > 0 ? 'amber' : 'green',
      },
    ],
    charts: {
      primary: {
        title: 'Faturamento por dia',
        description: 'Leitura diaria do valor vendido no periodo filtrado.',
        kind: 'trend',
        data: buildDailySalesSeries(completedSales, startDate, endDate),
      },
      secondary: {
        title: 'Pedidos por hora',
        description: 'Volume de pedidos por faixa horaria no recorte atual.',
        kind: 'bar',
        data: buildHourlyOrdersSeries(ordersInPeriod, completedSales),
      },
    },
    operations: {
      hero: {
        eyebrow: `${storeLabel} - ${shiftLabel}`,
        title: 'Leitura executiva da operacao',
        description: `${periodLabel} - ${formatInteger(ordersInPeriod.length)} pedidos monitorados, ${formatInteger(totalSalesCount)} vendas faturadas e ${formatInteger(activeCouriers.length)} entregadores ativos.`,
        statusLabel:
          totalOperationalRisks > 0
            ? `${formatInteger(totalOperationalRisks)} pontos de atencao`
            : 'Operacao sob controle',
        statusTone: totalOperationalRisks > 0 ? 'warning' : 'success',
        signals: [
          {
            id: 'hero-orders',
            label: 'Pedidos em aberto',
            value: formatInteger(openOrders.length),
            meta:
              delayedOrders.length > 0
                ? `${formatInteger(delayedOrders.length)} fora da janela`
                : `${formatPercent(orderCompletionRate, 0)} concluidos no recorte`,
          },
          {
            id: 'hero-cash',
            label: 'Saldo de caixa',
            value: formatCurrency(cashState.currentBalance),
            meta: cashState.status === 'aberto' ? 'caixa aberto no turno' : 'caixa fechado',
          },
          {
            id: 'hero-integrations',
            label: 'Saude das integracoes',
            value: zeSuccessRate != null ? formatPercent(zeSuccessRate, 0) : 'Sem sinal',
            meta: `Ze ${zeLastSyncSuccess === false ? 'com falha' : 'ok'} - iFood ${formatInteger(iFoodConfiguredCount)} loja(s)`,
          },
        ],
        actions: [
          { id: 'hero-orders-action', label: 'Pedidos', route: '/orders', variant: 'primary' },
          { id: 'hero-sales-action', label: 'Vendas', route: '/sales', variant: 'secondary' },
          { id: 'hero-cash-action', label: 'Caixa', route: '/cash', variant: 'secondary' },
          {
            id: 'hero-integrations-action',
            label: 'Integracoes',
            route: '/integrations/ze-delivery',
            variant: 'secondary',
          },
        ],
      },
      reminders,
      commandCenter: [
        {
          id: 'command-orders',
          label: 'Pedidos',
          value: formatInteger(openOrders.length),
          meta: `${formatInteger(ordersInPeriod.length)} no recorte - ${formatInteger(delayedOrders.length)} atrasados`,
          badgeText: delayedOrders.length > 0 ? 'fila' : 'ok',
          badgeClass: delayedOrders.length > 0 ? 'ui-badge--warning' : 'ui-badge--success',
          tone: delayedOrders.length > 0 ? 'amber' : 'green',
          route: '/orders',
          actionLabel: 'Abrir pedidos',
        },
        {
          id: 'command-sales',
          label: 'Vendas',
          value: formatCurrency(totalSold),
          meta: `${formatInteger(totalSalesCount)} vendas - ticket ${formatCurrency(averageTicket)}`,
          badgeText: 'turno',
          badgeClass: 'ui-badge--info',
          tone: 'blue',
          route: '/sales',
          actionLabel: 'Abrir vendas',
        },
        {
          id: 'command-cash',
          label: 'Caixa',
          value: cashState.status === 'aberto' ? 'Aberto' : 'Fechado',
          meta: `Saldo ${formatCurrency(cashState.currentBalance)} - ${formatInteger(cashState.pendingCount)} pendencia(s)`,
          badgeText: cashState.status === 'aberto' ? 'ao vivo' : 'turno',
          badgeClass: cashState.status === 'aberto' ? 'ui-badge--success' : 'ui-badge--neutral',
          tone: cashState.status === 'aberto' ? 'green' : 'blue',
          route: '/cash',
          actionLabel: 'Abrir caixa',
        },
        {
          id: 'command-pendings',
          label: 'Pendencias financeiras',
          value: formatInteger(openFinancialPendings.length),
          meta: `${formatCurrency(openFinancialPendingAmount)} em aberto - ${formatInteger(highPriorityFinancialPendings.length)} alta prioridade`,
          badgeText: highPriorityFinancialPendings.length > 0 ? 'critico' : 'controle',
          badgeClass:
            highPriorityFinancialPendings.length > 0 ? 'ui-badge--danger' : 'ui-badge--info',
          tone: highPriorityFinancialPendings.length > 0 ? 'red' : 'blue',
          route: '/financial-pendings',
          actionLabel: 'Abrir fila',
        },
        {
          id: 'command-integrations',
          label: 'Integracoes',
          value: zeSuccessRate != null ? formatPercent(zeSuccessRate, 0) : 'Sem sinal',
          meta: `Ze ${zeLastSyncSuccess === false ? 'instavel' : 'monitorado'} - iFood ${formatInteger(iFoodConfiguredCount)} configurado(s)`,
          badgeText: integrationIssueCount > 0 ? 'atencao' : 'estavel',
          badgeClass: integrationIssueCount > 0 ? 'ui-badge--warning' : 'ui-badge--success',
          tone: integrationIssueCount > 0 ? 'amber' : 'green',
          route: '/integrations/ze-delivery',
          actionLabel: 'Abrir painel',
        },
        {
          id: 'command-couriers',
          label: 'Entregadores',
          value: formatInteger(activeCouriers.length),
          meta: `${formatInteger(closedDeliveryReadings.length)} leituras fechadas - ${formatInteger(turboDeliveries.length)} turbo`,
          badgeText: 'escala',
          badgeClass: 'ui-badge--info',
          tone: 'blue',
          route: '/delivery-reading',
          actionLabel: 'Abrir operacao',
        },
      ],
      risks: [
        ...(delayedOrders.length > 0
          ? [
              {
                id: 'risk-delayed-orders',
                title: 'Pedidos fora da janela',
                description: 'Fila com risco de SLA e pressao no atendimento.',
                badgeText: formatInteger(delayedOrders.length),
                badgeClass: 'ui-badge--warning',
                tone: 'warning',
                route: '/orders',
              },
            ]
          : []),
        ...(highPriorityFinancialPendings.length > 0
          ? [
              {
                id: 'risk-financial-pending',
                title: 'Pendencias financeiras criticas',
                description: 'Clientes aguardando retorno ou ajuste financeiro.',
                badgeText: formatInteger(highPriorityFinancialPendings.length),
                badgeClass: 'ui-badge--danger',
                tone: 'danger',
                route: '/financial-pendings',
              },
            ]
          : []),
        ...(openChanges > 0
          ? [
              {
                id: 'risk-change-pending',
                title: 'Trocos ainda em aberto',
                description: 'Ajustes de devolucao ainda dependem de fechamento.',
                badgeText: formatInteger(openChanges),
                badgeClass: 'ui-badge--warning',
                tone: 'warning',
                route: '/change',
              },
            ]
          : []),
        ...(openOccurrences > 0
          ? [
              {
                id: 'risk-occurrences',
                title: 'Ocorrencias abertas',
                description: 'Problemas operacionais ainda sem fechamento.',
                badgeText: formatInteger(openOccurrences),
                badgeClass: 'ui-badge--warning',
                tone: 'warning',
                route: '/occurrences',
              },
            ]
          : []),
        ...(uncheckedMachines > 0
          ? [
              {
                id: 'risk-machines',
                title: 'Checklist de maquininhas pendente',
                description: 'Parque de pagamento ainda sem validacao completa.',
                badgeText: formatInteger(uncheckedMachines),
                badgeClass: 'ui-badge--info',
                tone: 'info',
                route: '/machine-history',
              },
            ]
          : []),
        ...(shouldShowAdvancesReminder
          ? [
              {
                id: 'risk-advances',
                title: 'Vales precisam de baixa',
                description: 'Financeiro deve revisar descontos antes do fechamento.',
                badgeText: formatInteger(openAdvances),
                badgeClass: 'ui-badge--warning',
                tone: 'warning',
                route: '/advances',
              },
            ]
          : []),
        ...(integrationIssueCount > 0
          ? [
              {
                id: 'risk-integrations',
                title: 'Integracoes instaveis',
                description: 'Falha recente de webhook ou scheduler externo.',
                badgeText: formatInteger(integrationIssueCount),
                badgeClass: 'ui-badge--danger',
                tone: 'danger',
                route: '/integrations/ze-delivery',
              },
            ]
          : []),
      ].slice(0, 5),
      activeShift: activeCouriers.slice(0, 5).map((record) => ({
        id: record.id,
        name: record.courier,
        role: getScheduleEntryTime(record.window) || 'Entrada nao informada',
        machine: record.machine ?? 'Sem maquininha',
        statusLabel: record.status ?? 'Confirmado',
        statusClass: getStatusBadgeClass(record.status),
      })),
      topProducts: topProducts.map((item) => ({
        id: item.id,
        title: summarizeProductName(item.name),
        description: `${formatCurrency(item.revenue)} faturados`,
        badgeText: `${formatInteger(item.quantity)} un.`,
        badgeClass: 'ui-badge--info',
      })),
      lowStock: lowStockItems.slice(0, 5).map((item) => ({
        id: item.id,
        title: toSentenceCase(item.productName ?? 'Produto'),
        description: `${formatInteger(item.currentStock)} un.`,
      })),
      financialPulse: [
        {
          id: 'finance-cash-balance',
          label: 'Saldo atual',
          value: formatCurrency(cashState.currentBalance),
          meta: cashState.status === 'aberto' ? 'caixa em operacao' : 'caixa encerrado',
        },
        {
          id: 'finance-income',
          label: 'Entradas',
          value: formatCurrency(totalIncome || totalSold),
          meta: `${formatInteger(totalSalesCount)} vendas faturadas`,
        },
        {
          id: 'finance-expense',
          label: 'Saidas',
          value: formatCurrency(totalExpense),
          meta: `${formatInteger(activeEntries.length)} lancamentos ativos`,
        },
        {
          id: 'finance-risk',
          label: 'Valor em risco',
          value: formatCurrency(openFinancialPendingAmount),
          meta: `${formatInteger(openFinancialPendings.length)} pendencia(s) abertas`,
        },
        {
          id: 'finance-change',
          label: 'Trocos pendentes',
          value: formatInteger(openChanges),
          meta: openChanges > 0 ? 'Revisar retornos do turno' : 'Sem ajuste pendente',
        },
      ],
      deliveryPulse: [
        {
          id: 'delivery-active',
          label: 'Entregadores na escala',
          value: formatInteger(activeCouriers.length),
          meta: `${formatInteger(registeredCouriers)} cadastrados`,
        },
        {
          id: 'delivery-open-reading',
          label: 'Leituras em aberto',
          value: formatInteger(openDeliveryReadings.length),
          meta: 'Acompanhar retorno e fechamento',
        },
        {
          id: 'delivery-closed-reading',
          label: 'Leituras fechadas',
          value: formatInteger(closedDeliveryReadings.length),
          meta: `${formatInteger(turboDeliveries.length)} entrega(s) turbo`,
        },
        {
          id: 'delivery-advances',
          label: 'Vales pendentes',
          value: formatInteger(openAdvances),
          meta: openAdvances > 0 ? 'Revisar antes do fechamento' : 'Sem pendencia',
        },
      ],
      integrationWatch: [
        {
          id: 'integration-ze-delivery',
          title: 'Ze Delivery',
          description:
            zeDeliveryStore?.status?.lastSyncAt != null
              ? `Ultima sincronizacao em ${formatDateTime(zeDeliveryStore.status.lastSyncAt)}`
              : 'Nenhum ciclo recente registrado',
          badgeText:
            zeSuccessRate != null
              ? formatPercent(zeSuccessRate, 0)
              : zeLastSyncSuccess === false
                ? 'erro'
                : 'monitorando',
          badgeClass: zeLastSyncSuccess === false ? 'ui-badge--danger' : 'ui-badge--success',
          route: '/integrations/ze-delivery',
        },
        {
          id: 'integration-ifood',
          title: 'iFood',
          description: `${formatInteger(externalIfoodOrders.length)} pedido(s) no recorte e ${formatInteger(iFoodConfiguredCount)} merchant(s) configurado(s)`,
          badgeText: iFoodConfiguredCount > 0 ? 'ativo' : 'configurar',
          badgeClass: iFoodConfiguredCount > 0 ? 'ui-badge--info' : 'ui-badge--warning',
          route: '/orders',
        },
        {
          id: 'integration-channel-mix',
          title: 'Canal externo',
          description: `${formatInteger(externalZeOrders.length)} pedido(s) Ze Delivery no recorte atual`,
          badgeText: integrationIssueCount > 0 ? 'atencao' : 'estavel',
          badgeClass: integrationIssueCount > 0 ? 'ui-badge--warning' : 'ui-badge--success',
          route: '/integrations/ze-delivery',
        },
      ],
    },
  }
}
