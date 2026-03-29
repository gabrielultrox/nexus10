import { buildCacheKey, cacheRemember } from '../cache/cacheService.js'
import { getAdminFirestore } from '../firebaseAdmin.js'
import { createLoggerContext, serializeError } from '../logging/logger.js'

const analyticsLogger = createLoggerContext({ module: 'analytics.builder' })
const ANALYTICS_CACHE_TTL_SECONDS = 60 * 60
const ORDER_DELAY_THRESHOLD_MINUTES = 35
const MAX_ANALYTICS_RANGE_DAYS = 366
const STORE_COLLECTION = 'stores'
const SALES_COLLECTION = 'sales'
const ORDERS_COLLECTION = 'orders'
const CUSTOMERS_COLLECTION = 'customers'
const PRODUCTS_COLLECTION = 'products'

type AnalyticsModuleFilter = 'all' | 'pdv' | 'ifood' | 'ze_delivery'
type AnalyticsCompareBy = 'previous_period' | 'week' | 'month' | 'year'

interface AnalyticsQueryInput {
  storeId: string
  startDate: string
  endDate: string
  module?: AnalyticsModuleFilter
  compareBy?: AnalyticsCompareBy
}

interface FirestoreLikeDocument {
  id: string
  data: () => Record<string, unknown>
}

interface QueryRange {
  start: Date
  end: Date
}

interface NormalizedSaleItem {
  productId: string | null
  productName: string
  category: string
  quantity: number
  unitPrice: number
  totalPrice: number
  cost: number
}

interface NormalizedSaleRecord {
  id: string
  channel: string
  customerId: string | null
  createdAt: Date
  total: number
  discountValue: number
  subtotal: number
  items: NormalizedSaleItem[]
}

interface NormalizedOrderRecord {
  id: string
  channel: string
  status: string
  customerId: string | null
  courierName: string
  createdAt: Date
  updatedAt: Date
  deliveredAt: Date | null
  cancellationReason: string
}

interface NormalizedCustomerRecord {
  id: string
  createdAt: Date | null
}

interface NormalizedProductRecord {
  id: string
  name: string
  category: string
  cost: number
}

interface AnalyticsMetricCard {
  id: string
  label: string
  value: string
  delta: string
  description: string
  variant: 'positive' | 'negative' | 'neutral'
  badge?: string
}

interface ChartDatum {
  label: string
  value: number
}

interface PieDatum extends ChartDatum {
  share: number
}

interface HeatmapDatum {
  day: string
  hour: string
  value: number
}

interface AnalyticsChart {
  id: string
  title: string
  description: string
  kind: 'line' | 'bar' | 'pie' | 'heatmap'
  valuePrefix?: string
  data: ChartDatum[] | PieDatum[] | HeatmapDatum[]
}

interface AnalyticsAlert {
  id: string
  tone: 'success' | 'warning' | 'danger' | 'info'
  title: string
  description: string
}

interface AnalyticsResponse {
  generatedAt: string
  cacheTtlSeconds: number
  filters: {
    storeId: string
    startDate: string
    endDate: string
    module: AnalyticsModuleFilter
    compareBy: AnalyticsCompareBy
  }
  comparisons: {
    current: { startDate: string; endDate: string }
    previous: { startDate: string; endDate: string }
  }
  metrics: AnalyticsMetricCard[]
  charts: AnalyticsChart[]
  highlights: {
    bestProduct: { name: string; quantity: number; revenue: number } | null
    worstProduct: { name: string; quantity: number; revenue: number } | null
    strongestCourier: { name: string; ordersPerHour: number; lateRate: number } | null
    weakestCourier: { name: string; ordersPerHour: number; lateRate: number } | null
    anomalies: Array<{ label: string; value: number; delta: number }>
  }
  alerts: AnalyticsAlert[]
  metadata: {
    records: {
      sales: number
      orders: number
      customers: number
      products: number
    }
    targetSource: string
    filterLatencyMs: number
  }
}

function parseDateAtBoundary(value: string, boundary: 'start' | 'end'): Date {
  const suffix = boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z'
  return new Date(`${value}${suffix}`)
}

function differenceInCalendarDays(left: Date, right: Date): number {
  const ms = left.getTime() - right.getTime()
  return Math.max(1, Math.round(ms / 86_400_000) + 1)
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(Math.round(value))
}

function formatPercent(value: number, digits = 1): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value / 100)
}

function formatDelta(current: number, previous: number, suffix = '%'): string {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return '0.0%'
  }

  const delta = ((current - previous) / Math.abs(previous)) * 100
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}${suffix}`
}

function resolveDeltaVariant(value: number): 'positive' | 'negative' | 'neutral' {
  if (value > 0.25) {
    return 'positive'
  }

  if (value < -0.25) {
    return 'negative'
  }

  return 'neutral'
}

function asDate(value: unknown): Date | null {
  if (!value) {
    return null
  }

  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }

  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeChannel(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
}

function normalizeModuleFilter(value: string | undefined): AnalyticsModuleFilter {
  const normalized = String(value ?? 'all')
    .trim()
    .toLowerCase()

  if (normalized === 'ifood') {
    return 'ifood'
  }

  if (normalized === 'ze_delivery') {
    return 'ze_delivery'
  }

  if (normalized === 'pdv') {
    return 'pdv'
  }

  return 'all'
}

function normalizeCompareBy(value: string | undefined): AnalyticsCompareBy {
  const normalized = String(value ?? 'previous_period')
    .trim()
    .toLowerCase()

  if (normalized === 'week') {
    return 'week'
  }

  if (normalized === 'month') {
    return 'month'
  }

  if (normalized === 'year') {
    return 'year'
  }

  return 'previous_period'
}

function resolvePreviousRange(range: QueryRange, compareBy: AnalyticsCompareBy): QueryRange {
  const currentStart = new Date(range.start)
  const currentEnd = new Date(range.end)

  if (compareBy === 'week') {
    currentStart.setUTCDate(currentStart.getUTCDate() - 7)
    currentEnd.setUTCDate(currentEnd.getUTCDate() - 7)
    return { start: currentStart, end: currentEnd }
  }

  if (compareBy === 'month') {
    currentStart.setUTCMonth(currentStart.getUTCMonth() - 1)
    currentEnd.setUTCMonth(currentEnd.getUTCMonth() - 1)
    return { start: currentStart, end: currentEnd }
  }

  if (compareBy === 'year') {
    currentStart.setUTCFullYear(currentStart.getUTCFullYear() - 1)
    currentEnd.setUTCFullYear(currentEnd.getUTCFullYear() - 1)
    return { start: currentStart, end: currentEnd }
  }

  const rangeDays = differenceInCalendarDays(range.end, range.start)
  const previousEnd = new Date(range.start)
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1)
  previousEnd.setUTCHours(23, 59, 59, 999)
  const previousStart = new Date(previousEnd)
  previousStart.setUTCDate(previousStart.getUTCDate() - (rangeDays - 1))
  previousStart.setUTCHours(0, 0, 0, 0)
  return { start: previousStart, end: previousEnd }
}

function assertValidRange(startDate: string, endDate: string): QueryRange {
  const start = parseDateAtBoundary(startDate, 'start')
  const end = parseDateAtBoundary(endDate, 'end')

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Periodo invalido para analytics.')
  }

  if (start > end) {
    throw new Error('Data inicial nao pode ser maior que a data final.')
  }

  if (differenceInCalendarDays(end, start) > MAX_ANALYTICS_RANGE_DAYS) {
    throw new Error('O dashboard analitico suporta no maximo 1 ano por consulta.')
  }

  return { start, end }
}

function matchesModule(channel: string, moduleFilter: AnalyticsModuleFilter): boolean {
  if (moduleFilter === 'all') {
    return true
  }

  if (moduleFilter === 'ifood') {
    return channel === 'IFOOD'
  }

  if (moduleFilter === 'ze_delivery') {
    return channel === 'ZE_DELIVERY'
  }

  return channel !== 'IFOOD' && channel !== 'ZE_DELIVERY'
}

function isWithinRange(date: Date | null, range: QueryRange): boolean {
  if (!date) {
    return false
  }

  return date >= range.start && date <= range.end
}

function isClosedOrderStatus(status: string): boolean {
  return ['DELIVERED', 'CANCELLED', 'CONVERTED_TO_SALE', 'POSTED'].includes(status)
}

function normalizeSales(
  docs: FirestoreLikeDocument[],
  productsById: Map<string, NormalizedProductRecord>,
): NormalizedSaleRecord[] {
  return docs
    .map((documentSnapshot) => {
      const data = documentSnapshot.data() as Record<string, any>
      const createdAt = asDate(data.createdAt)

      if (!createdAt) {
        return null
      }

      const items = Array.isArray(data.items)
        ? data.items.map((item) => {
            const productId = String(item?.productId ?? item?.productSnapshot?.id ?? '')
            const product = productId ? productsById.get(productId) : null
            return {
              productId: productId || null,
              productName: String(
                item?.productSnapshot?.name ??
                  item?.name ??
                  product?.name ??
                  'Produto nao identificado',
              ),
              category: String(
                item?.productSnapshot?.category ?? product?.category ?? 'Sem categoria',
              ),
              quantity: toNumber(item?.quantity),
              unitPrice: toNumber(item?.unitPrice),
              totalPrice: toNumber(item?.totalPrice ?? item?.total),
              cost: toNumber(item?.productSnapshot?.cost ?? product?.cost),
            }
          })
        : []

      return {
        id: documentSnapshot.id,
        channel: normalizeChannel(data.channel ?? data.origin ?? data.source ?? data.sourceChannel),
        customerId: data.customerId
          ? String(data.customerId)
          : String(data.customerSnapshot?.id ?? '') || null,
        createdAt,
        total: toNumber(data.totals?.total ?? data.total),
        subtotal: toNumber(data.totals?.subtotal ?? data.subtotal),
        discountValue: toNumber(data.totals?.discountValue ?? data.discount),
        items,
      } satisfies NormalizedSaleRecord
    })
    .filter(Boolean) as NormalizedSaleRecord[]
}

function normalizeOrders(docs: FirestoreLikeDocument[]): NormalizedOrderRecord[] {
  return docs
    .map((documentSnapshot) => {
      const data = documentSnapshot.data() as Record<string, any>
      const createdAt = asDate(data.createdAt)

      if (!createdAt) {
        return null
      }

      const updatedAt = asDate(data.updatedAt) ?? createdAt
      const deliveredAt =
        asDate(data.deliveredAt) ??
        asDate(data.closedAt) ??
        (isClosedOrderStatus(String(data.status ?? '').toUpperCase()) ? updatedAt : null)

      return {
        id: documentSnapshot.id,
        channel: normalizeChannel(data.channel ?? data.origin ?? data.source ?? data.sourceChannel),
        status: String(data.status ?? '').toUpperCase(),
        customerId: data.customerId
          ? String(data.customerId)
          : String(data.customerSnapshot?.id ?? '') || null,
        courierName: String(
          data.courierName ??
            data.assignedCourierName ??
            data.courierSnapshot?.name ??
            'Nao atribuido',
        ),
        createdAt,
        updatedAt,
        deliveredAt,
        cancellationReason: String(
          data.cancelReason ?? data.cancellationReason ?? data.reason ?? 'Sem motivo informado',
        ),
      } satisfies NormalizedOrderRecord
    })
    .filter(Boolean) as NormalizedOrderRecord[]
}

function normalizeCustomers(docs: FirestoreLikeDocument[]): NormalizedCustomerRecord[] {
  return docs.map((documentSnapshot) => {
    const data = documentSnapshot.data() as Record<string, any>
    return {
      id: documentSnapshot.id,
      createdAt: asDate(data.createdAt),
    }
  })
}

function normalizeProducts(docs: FirestoreLikeDocument[]): NormalizedProductRecord[] {
  return docs.map((documentSnapshot) => {
    const data = documentSnapshot.data() as Record<string, any>
    return {
      id: documentSnapshot.id,
      name: String(data.name ?? 'Produto'),
      category: String(data.category ?? 'Sem categoria'),
      cost: toNumber(data.cost),
    }
  })
}

async function readCollectionDocuments(
  storeId: string,
  collectionName: string,
): Promise<FirestoreLikeDocument[]> {
  const firestore = getAdminFirestore()
  const snapshot = await firestore
    .collection(STORE_COLLECTION)
    .doc(storeId)
    .collection(collectionName)
    .get()

  return snapshot.docs as FirestoreLikeDocument[]
}

function groupSalesByDay(records: NormalizedSaleRecord[], range: QueryRange): ChartDatum[] {
  const totals = new Map<string, number>()
  const cursor = new Date(range.start)

  while (cursor <= range.end) {
    totals.set(formatDateKey(cursor), 0)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  records.forEach((record) => {
    const key = formatDateKey(record.createdAt)
    totals.set(key, toNumber((totals.get(key) ?? 0) + record.total))
  })

  return Array.from(totals.entries()).map(([key, value]) => ({
    label: formatDayLabel(new Date(`${key}T00:00:00.000Z`)),
    value: Number(value.toFixed(2)),
  }))
}

function groupOrdersByCourier(records: NormalizedOrderRecord[]): ChartDatum[] {
  const couriers = new Map<string, number>()

  records.forEach((record) => {
    const label = record.courierName || 'Nao atribuido'
    couriers.set(label, (couriers.get(label) ?? 0) + 1)
  })

  return Array.from(couriers.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 6)
}

function groupSalesByCategory(records: NormalizedSaleRecord[]): PieDatum[] {
  const categories = new Map<string, number>()

  records.forEach((record) => {
    record.items.forEach((item) => {
      categories.set(item.category, (categories.get(item.category) ?? 0) + item.totalPrice)
    })
  })

  const total = Array.from(categories.values()).reduce((sum, value) => sum + value, 0)

  return Array.from(categories.entries())
    .map(([label, value]) => ({
      label,
      value: Number(value.toFixed(2)),
      share: total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0,
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 6)
}

function buildSalesHeatmap(records: NormalizedSaleRecord[]): HeatmapDatum[] {
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
  const cells = new Map<string, number>()

  weekdays.forEach((day) => {
    for (let hour = 0; hour < 24; hour += 1) {
      cells.set(`${day}-${hour}`, 0)
    }
  })

  records.forEach((record) => {
    const day = weekdays[record.createdAt.getUTCDay()]
    const hour = record.createdAt.getUTCHours()
    const key = `${day}-${hour}`
    cells.set(key, (cells.get(key) ?? 0) + record.total)
  })

  return weekdays.flatMap((day) =>
    Array.from({ length: 24 }, (_, hour) => ({
      day,
      hour: String(hour).padStart(2, '0'),
      value: Number((cells.get(`${day}-${hour}`) ?? 0).toFixed(2)),
    })),
  )
}

function buildCancellationSeries(records: NormalizedOrderRecord[]): ChartDatum[] {
  const reasons = new Map<string, number>()

  records
    .filter((record) => record.status === 'CANCELLED')
    .forEach((record) => {
      reasons.set(record.cancellationReason, (reasons.get(record.cancellationReason) ?? 0) + 1)
    })

  return Array.from(reasons.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 6)
}

function buildAnomalies(series: ChartDatum[]) {
  if (series.length < 4) {
    return []
  }

  const values = series.map((item) => item.value)
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(values.length, 1)
  const deviation = Math.sqrt(variance)
  const threshold = deviation * 1.75

  return series
    .filter((item) => Math.abs(item.value - average) >= threshold)
    .map((item) => ({
      label: item.label,
      value: Number(item.value.toFixed(2)),
      delta: Number((item.value - average).toFixed(2)),
    }))
    .slice(0, 5)
}

function buildProductsHighlights(records: NormalizedSaleRecord[]) {
  const products = new Map<
    string,
    { name: string; quantity: number; revenue: number; margin: number }
  >()

  records.forEach((record) => {
    record.items.forEach((item) => {
      const key = item.productId ?? item.productName
      const existing = products.get(key) ?? {
        name: item.productName,
        quantity: 0,
        revenue: 0,
        margin: 0,
      }

      existing.quantity += item.quantity
      existing.revenue += item.totalPrice
      existing.margin += item.totalPrice - item.cost * item.quantity
      products.set(key, existing)
    })
  })

  const ranked = Array.from(products.values()).sort((left, right) => right.quantity - left.quantity)

  return {
    bestProduct: ranked[0]
      ? {
          name: ranked[0].name,
          quantity: ranked[0].quantity,
          revenue: Number(ranked[0].revenue.toFixed(2)),
        }
      : null,
    worstProduct: ranked[ranked.length - 1]
      ? {
          name: ranked[ranked.length - 1].name,
          quantity: ranked[ranked.length - 1].quantity,
          revenue: Number(ranked[ranked.length - 1].revenue.toFixed(2)),
        }
      : null,
    marginByProduct: ranked
      .map((item) => ({
        label: item.name,
        value: Number(item.margin.toFixed(2)),
      }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 6),
  }
}

function buildCourierHighlights(records: NormalizedOrderRecord[], range: QueryRange) {
  const hours = Math.max(1, (range.end.getTime() - range.start.getTime()) / 3_600_000)
  const couriers = new Map<
    string,
    {
      delivered: number
      late: number
      elapsedMinutes: number
      ordersPerHour: number
      lateRate: number
    }
  >()

  records
    .filter((record) => record.courierName && record.courierName !== 'Nao atribuido')
    .forEach((record) => {
      const key = record.courierName
      const current = couriers.get(key) ?? {
        delivered: 0,
        late: 0,
        elapsedMinutes: 0,
        ordersPerHour: 0,
        lateRate: 0,
      }

      if (record.status === 'DELIVERED') {
        current.delivered += 1
      }

      const finishedAt = record.deliveredAt ?? record.updatedAt
      const elapsed = Math.max(0, (finishedAt.getTime() - record.createdAt.getTime()) / 60_000)
      current.elapsedMinutes += elapsed

      if (elapsed >= ORDER_DELAY_THRESHOLD_MINUTES) {
        current.late += 1
      }

      couriers.set(key, current)
    })

  const ranked = Array.from(couriers.entries())
    .map(([name, item]) => {
      const delivered = Math.max(item.delivered, 0)
      const ordersPerHour = delivered > 0 ? delivered / hours : 0
      const lateRate = delivered > 0 ? (item.late / delivered) * 100 : 0
      return {
        name,
        delivered,
        late: item.late,
        ordersPerHour: Number(ordersPerHour.toFixed(2)),
        lateRate: Number(lateRate.toFixed(1)),
      }
    })
    .sort((left, right) => right.ordersPerHour - left.ordersPerHour)

  const strongestCourier = ranked[0] ?? null
  const weakestCourier = ranked.length > 1 ? ranked[ranked.length - 1] : (ranked[0] ?? null)

  return {
    strongestCourier,
    weakestCourier,
    performanceChart: ranked.slice(0, 6).map((item) => ({
      label: item.name,
      value: item.ordersPerHour,
    })),
  }
}

function calculateCustomerSplit(
  sales: NormalizedSaleRecord[],
  customers: NormalizedCustomerRecord[],
  range: QueryRange,
) {
  const customerCreatedAt = new Map(customers.map((customer) => [customer.id, customer.createdAt]))
  let newCustomers = 0
  let recurringCustomers = 0

  sales.forEach((sale) => {
    if (!sale.customerId) {
      return
    }

    const createdAt = customerCreatedAt.get(sale.customerId)

    if (createdAt && isWithinRange(createdAt, range)) {
      newCustomers += 1
      return
    }

    recurringCustomers += 1
  })

  return {
    newCustomers,
    recurringCustomers,
  }
}

function buildAlerts(input: {
  anomalies: Array<{ label: string; value: number; delta: number }>
  cancellationRate: number
  courierLateRate: number
  salesVsTarget: number
}): AnalyticsAlert[] {
  const alerts: AnalyticsAlert[] = []

  if (input.salesVsTarget < 90) {
    alerts.push({
      id: 'sales-target',
      tone: 'warning',
      title: 'Vendas abaixo da meta operacional',
      description: 'O faturamento do recorte esta abaixo do baseline esperado para a loja.',
    })
  }

  if (input.cancellationRate >= 5) {
    alerts.push({
      id: 'cancellation-rate',
      tone: 'danger',
      title: 'Taxa de cancelamento acima do limite',
      description: 'O volume de cancelamentos ja impacta margem e previsibilidade da operacao.',
    })
  }

  if (input.courierLateRate >= 18) {
    alerts.push({
      id: 'courier-late-rate',
      tone: 'warning',
      title: 'Atrasos de entrega acima do normal',
      description: 'A taxa de atraso por entregador indica gargalo na ultima milha.',
    })
  }

  if (input.anomalies.length > 0) {
    alerts.push({
      id: 'sales-anomalies',
      tone: 'info',
      title: 'Picos ou quedas inesperadas detectados',
      description: 'Existem dias com desvio relevante do padrao recente de vendas.',
    })
  }

  if (alerts.length === 0) {
    alerts.push({
      id: 'analytics-steady',
      tone: 'success',
      title: 'Indicadores analiticos sem anomalias criticas',
      description: 'O periodo atual esta dentro da faixa esperada para vendas e entrega.',
    })
  }

  return alerts
}

function buildMetrics(input: {
  totalSales: number
  previousSales: number
  targetSales: number
  marginPercent: number
  previousMarginPercent: number
  cancellationRate: number
  previousCancellationRate: number
  customerSplit: { newCustomers: number; recurringCustomers: number }
  previousCustomerSplit: { newCustomers: number; recurringCustomers: number }
  strongestCourier: { name: string; ordersPerHour: number; lateRate: number } | null
  previousCourierOrdersPerHour: number
  bestProduct: { name: string; quantity: number; revenue: number } | null
  worstProduct: { name: string; quantity: number; revenue: number } | null
}): AnalyticsMetricCard[] {
  const salesVsTargetPercent =
    input.targetSales > 0 ? (input.totalSales / input.targetSales) * 100 : 0
  const customerShareCurrent =
    input.customerSplit.newCustomers + input.customerSplit.recurringCustomers > 0
      ? (input.customerSplit.newCustomers /
          (input.customerSplit.newCustomers + input.customerSplit.recurringCustomers)) *
        100
      : 0
  const customerSharePrevious =
    input.previousCustomerSplit.newCustomers + input.previousCustomerSplit.recurringCustomers > 0
      ? (input.previousCustomerSplit.newCustomers /
          (input.previousCustomerSplit.newCustomers +
            input.previousCustomerSplit.recurringCustomers)) *
        100
      : 0

  return [
    {
      id: 'sales-vs-target',
      label: 'Vendas vs meta',
      value: formatPercent(salesVsTargetPercent, 1),
      delta: formatDelta(input.totalSales, input.previousSales),
      description: `${formatCurrency(input.totalSales)} no periodo atual contra meta de ${formatCurrency(input.targetSales)}`,
      variant: resolveDeltaVariant(input.totalSales - input.previousSales),
      badge: salesVsTargetPercent >= 100 ? 'ok' : 'meta',
    },
    {
      id: 'margin',
      label: 'Margem de lucro',
      value: formatPercent(input.marginPercent, 1),
      delta: formatDelta(input.marginPercent, input.previousMarginPercent),
      description:
        input.bestProduct != null
          ? `Maior contribuicao: ${input.bestProduct.name}`
          : 'Sem volume suficiente para identificar margem por produto',
      variant: resolveDeltaVariant(input.marginPercent - input.previousMarginPercent),
      badge: 'margem',
    },
    {
      id: 'courier-performance',
      label: 'Entregador lider',
      value: input.strongestCourier ? `${input.strongestCourier.ordersPerHour.toFixed(1)}/h` : '--',
      delta: formatDelta(
        input.strongestCourier?.ordersPerHour ?? 0,
        input.previousCourierOrdersPerHour,
      ),
      description: input.strongestCourier
        ? `${input.strongestCourier.name} - atraso ${formatPercent(input.strongestCourier.lateRate, 1)}`
        : 'Sem entregas suficientes no periodo',
      variant: resolveDeltaVariant(
        (input.strongestCourier?.ordersPerHour ?? 0) - input.previousCourierOrdersPerHour,
      ),
      badge: 'rota',
    },
    {
      id: 'cancellations',
      label: 'Taxa de cancelamento',
      value: formatPercent(input.cancellationRate, 1),
      delta: formatDelta(input.cancellationRate, input.previousCancellationRate),
      description:
        input.worstProduct != null
          ? `Menor giro: ${input.worstProduct.name}`
          : 'Sem cancelamentos relevantes no recorte',
      variant: resolveDeltaVariant(input.previousCancellationRate - input.cancellationRate),
      badge: 'cancel.',
    },
    {
      id: 'customer-evolution',
      label: 'Clientes novos',
      value: formatPercent(customerShareCurrent, 1),
      delta: formatDelta(customerShareCurrent, customerSharePrevious),
      description: `${formatInteger(input.customerSplit.newCustomers)} novos vs ${formatInteger(
        input.customerSplit.recurringCustomers,
      )} recorrentes`,
      variant: resolveDeltaVariant(customerShareCurrent - customerSharePrevious),
      badge: 'crm',
    },
  ]
}

function filterSalesByRangeAndModule(
  records: NormalizedSaleRecord[],
  range: QueryRange,
  moduleFilter: AnalyticsModuleFilter,
) {
  return records.filter(
    (record) =>
      isWithinRange(record.createdAt, range) && matchesModule(record.channel, moduleFilter),
  )
}

function filterOrdersByRangeAndModule(
  records: NormalizedOrderRecord[],
  range: QueryRange,
  moduleFilter: AnalyticsModuleFilter,
) {
  return records.filter(
    (record) =>
      isWithinRange(record.createdAt, range) && matchesModule(record.channel, moduleFilter),
  )
}

function buildAnalyticsSnapshotFromRecords(input: {
  storeId: string
  startDate: string
  endDate: string
  moduleFilter: AnalyticsModuleFilter
  compareBy: AnalyticsCompareBy
  sales: NormalizedSaleRecord[]
  orders: NormalizedOrderRecord[]
  customers: NormalizedCustomerRecord[]
  productsCount: number
}): AnalyticsResponse {
  const startedAt = Date.now()
  const currentRange = assertValidRange(input.startDate, input.endDate)
  const previousRange = resolvePreviousRange(currentRange, input.compareBy)
  const currentSales = filterSalesByRangeAndModule(input.sales, currentRange, input.moduleFilter)
  const previousSales = filterSalesByRangeAndModule(input.sales, previousRange, input.moduleFilter)
  const currentOrders = filterOrdersByRangeAndModule(input.orders, currentRange, input.moduleFilter)
  const previousOrders = filterOrdersByRangeAndModule(
    input.orders,
    previousRange,
    input.moduleFilter,
  )

  const totalSales = currentSales.reduce((sum, sale) => sum + sale.total, 0)
  const previousTotalSales = previousSales.reduce((sum, sale) => sum + sale.total, 0)
  const totalMarginValue = currentSales.reduce(
    (sum, sale) =>
      sum +
      sale.items.reduce(
        (itemSum, item) => itemSum + (item.totalPrice - item.cost * item.quantity),
        0,
      ),
    0,
  )
  const previousMarginValue = previousSales.reduce(
    (sum, sale) =>
      sum +
      sale.items.reduce(
        (itemSum, item) => itemSum + (item.totalPrice - item.cost * item.quantity),
        0,
      ),
    0,
  )
  const marginPercent = totalSales > 0 ? (totalMarginValue / totalSales) * 100 : 0
  const previousMarginPercent =
    previousTotalSales > 0 ? (previousMarginValue / previousTotalSales) * 100 : 0
  const currentCancelledOrders = currentOrders.filter((order) => order.status === 'CANCELLED')
  const previousCancelledOrders = previousOrders.filter((order) => order.status === 'CANCELLED')
  const cancellationRate =
    currentOrders.length > 0 ? (currentCancelledOrders.length / currentOrders.length) * 100 : 0
  const previousCancellationRate =
    previousOrders.length > 0 ? (previousCancelledOrders.length / previousOrders.length) * 100 : 0

  const currentDailySeries = groupSalesByDay(currentSales, currentRange)
  const anomalies = buildAnomalies(currentDailySeries)
  const categorySeries = groupSalesByCategory(currentSales)
  const cancellationSeries = buildCancellationSeries(currentOrders)
  const productHighlights = buildProductsHighlights(currentSales)
  const courierHighlights = buildCourierHighlights(currentOrders, currentRange)
  const previousCourierHighlights = buildCourierHighlights(previousOrders, previousRange)
  const currentCustomerSplit = calculateCustomerSplit(currentSales, input.customers, currentRange)
  const previousCustomerSplit = calculateCustomerSplit(
    previousSales,
    input.customers,
    previousRange,
  )
  const targetSales = previousTotalSales > 0 ? previousTotalSales * 1.05 : totalSales || 1
  const deliveredOrders = currentOrders.filter((order) => order.status === 'DELIVERED')
  const averageCourierLateRate =
    deliveredOrders.length > 0
      ? (deliveredOrders.filter((order) => {
          const finishedAt = order.deliveredAt ?? order.updatedAt
          return (
            (finishedAt.getTime() - order.createdAt.getTime()) / 60_000 >=
            ORDER_DELAY_THRESHOLD_MINUTES
          )
        }).length /
          deliveredOrders.length) *
        100
      : 0

  return {
    generatedAt: new Date().toISOString(),
    cacheTtlSeconds: ANALYTICS_CACHE_TTL_SECONDS,
    filters: {
      storeId: input.storeId,
      startDate: input.startDate,
      endDate: input.endDate,
      module: input.moduleFilter,
      compareBy: input.compareBy,
    },
    comparisons: {
      current: {
        startDate: formatDateKey(currentRange.start),
        endDate: formatDateKey(currentRange.end),
      },
      previous: {
        startDate: formatDateKey(previousRange.start),
        endDate: formatDateKey(previousRange.end),
      },
    },
    metrics: buildMetrics({
      totalSales,
      previousSales: previousTotalSales,
      targetSales,
      marginPercent,
      previousMarginPercent,
      cancellationRate,
      previousCancellationRate,
      customerSplit: currentCustomerSplit,
      previousCustomerSplit,
      strongestCourier: courierHighlights.strongestCourier,
      previousCourierOrdersPerHour: previousCourierHighlights.strongestCourier?.ordersPerHour ?? 0,
      bestProduct: productHighlights.bestProduct,
      worstProduct: productHighlights.worstProduct,
    }),
    charts: [
      {
        id: 'sales-trend',
        title: 'Vendas ao longo do tempo',
        description: 'Faturamento diario do periodo filtrado comparado com a curva recente.',
        kind: 'line',
        valuePrefix: 'R$',
        data: currentDailySeries,
      },
      {
        id: 'category-mix',
        title: 'Mix por categoria',
        description: 'Participacao das categorias mais relevantes no faturamento.',
        kind: 'pie',
        valuePrefix: 'R$',
        data: categorySeries,
      },
      {
        id: 'courier-performance',
        title: 'Performance de entregadores',
        description: 'Pedidos por hora dos entregadores com maior volume no recorte.',
        kind: 'bar',
        data: courierHighlights.performanceChart,
      },
      {
        id: 'sales-heatmap',
        title: 'Heatmap de vendas por hora',
        description: 'Concentracao de venda por dia da semana e hora operacional.',
        kind: 'heatmap',
        valuePrefix: 'R$',
        data: buildSalesHeatmap(currentSales),
      },
      {
        id: 'cancellations',
        title: 'Motivos de cancelamento',
        description: 'Top motivos de cancelamento que impactaram o periodo.',
        kind: 'bar',
        data:
          cancellationSeries.length > 0
            ? cancellationSeries
            : [{ label: 'Sem cancelamentos', value: 0 }],
      },
    ],
    highlights: {
      bestProduct: productHighlights.bestProduct,
      worstProduct: productHighlights.worstProduct,
      strongestCourier: courierHighlights.strongestCourier,
      weakestCourier: courierHighlights.weakestCourier,
      anomalies,
    },
    alerts: buildAlerts({
      anomalies,
      cancellationRate,
      courierLateRate: averageCourierLateRate,
      salesVsTarget: (totalSales / Math.max(targetSales, 1)) * 100,
    }),
    metadata: {
      records: {
        sales: currentSales.length,
        orders: currentOrders.length,
        customers: input.customers.length,
        products: input.productsCount,
      },
      targetSource:
        previousTotalSales > 0 ? 'Baseline do periodo anterior +5%' : 'Baseline do periodo atual',
      filterLatencyMs: Date.now() - startedAt,
    },
  }
}

export async function buildAnalyticsSnapshot(
  query: AnalyticsQueryInput,
): Promise<AnalyticsResponse> {
  const moduleFilter = normalizeModuleFilter(query.module)
  const compareBy = normalizeCompareBy(query.compareBy)
  const currentRange = assertValidRange(query.startDate, query.endDate)

  return (await cacheRemember({
    key: buildCacheKey(
      'analytics',
      query.storeId,
      query.startDate,
      query.endDate,
      moduleFilter,
      compareBy,
    ),
    ttlSeconds: ANALYTICS_CACHE_TTL_SECONDS,
    loader: async () => {
      try {
        const [productDocs, salesDocs, orderDocs, customerDocs] = await Promise.all([
          readCollectionDocuments(query.storeId, PRODUCTS_COLLECTION),
          readCollectionDocuments(query.storeId, SALES_COLLECTION),
          readCollectionDocuments(query.storeId, ORDERS_COLLECTION),
          readCollectionDocuments(query.storeId, CUSTOMERS_COLLECTION),
        ])

        const products = normalizeProducts(productDocs)
        const productsById = new Map(products.map((product) => [product.id, product]))
        const sales = normalizeSales(salesDocs, productsById)
        const orders = normalizeOrders(orderDocs)
        const customers = normalizeCustomers(customerDocs)

        return buildAnalyticsSnapshotFromRecords({
          storeId: query.storeId,
          startDate: formatDateKey(currentRange.start),
          endDate: formatDateKey(currentRange.end),
          moduleFilter,
          compareBy,
          sales,
          orders,
          customers,
          productsCount: products.length,
        })
      } catch (error) {
        analyticsLogger.error(
          {
            context: 'analytics.build',
            storeId: query.storeId,
            error: serializeError(error),
          },
          'Failed to build analytics snapshot',
        )
        throw error
      }
    },
  })) as AnalyticsResponse
}

export const __analyticsTestUtils = {
  buildAnalyticsSnapshotFromRecords,
  resolvePreviousRange,
  assertValidRange,
}
