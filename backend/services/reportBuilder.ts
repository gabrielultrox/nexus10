import { randomUUID } from 'node:crypto'

import ExcelJS from 'exceljs'
import sharp from 'sharp'

import { getAdminFirestore, getAdminStorageBucket } from '../firebaseAdmin.js'
import { createLoggerContext, serializeError } from '../logging/logger.js'
import type { AuthenticatedUserContext, ReportFormat, ReportType } from '../types/index.js'

const REPORTS_COLLECTION = 'reports'
const RETENTION_DAYS = 30
const MAX_FILE_SIZE_BYTES = 1_000_000
const MAX_COLLECTION_FETCH = 5_000
const reportLogger = createLoggerContext({ module: 'reports.builder' })

type ReportStatus = 'queued' | 'processing' | 'completed' | 'failed'

interface ReportFilters {
  startDate: string
  endDate: string
  operator?: string
  module?: string
  template?: string
  scheduledFor?: string | null
}

interface ReportRequest {
  storeId: string
  type: ReportType
  format: ReportFormat
  filters: ReportFilters
  actor: AuthenticatedUserContext
}

interface ReportHistoryRecord {
  id: string
  storeId: string
  type: ReportType
  format: ReportFormat
  status: ReportStatus
  template: string
  filters: ReportFilters
  createdBy: {
    uid: string | null
    name: string | null
    role: string | null
  }
  fileName: string | null
  storagePath: string | null
  sizeBytes: number | null
  contentType: string | null
  summary: Record<string, unknown> | null
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
  expiresAt: string | null
  scheduledFor: string | null
}

interface GeneratedAsset {
  buffer: Uint8Array
  fileName: string
  contentType: string
  summary: Record<string, unknown>
}

function getStoreReportsCollection(storeId: string) {
  return getAdminFirestore().collection('stores').doc(storeId).collection(REPORTS_COLLECTION)
}

function asDate(value: unknown): Date | null {
  if (!value) {
    return null
  }

  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }

  const dateValue = new Date(String(value))
  return Number.isNaN(dateValue.getTime()) ? null : dateValue
}

function parseMoney(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function buildReportId(): string {
  return `report-${randomUUID()}`
}

function buildFileName(storeId: string, type: ReportType, format: ReportFormat): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `nexus10-${storeId}-${type}-${stamp}.${format === 'pdf' ? 'pdf' : 'xlsx'}`
}

function toIsoDate(date: Date): string {
  return date.toISOString()
}

function getExpirationDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + RETENTION_DAYS)
  return date.toISOString()
}

function isWithinPeriod(value: unknown, startDate: string, endDate: string): boolean {
  const dateValue = asDate(value)
  if (!dateValue) {
    return false
  }

  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T23:59:59`)
  return dateValue >= start && dateValue <= end
}

function matchesText(value: unknown, search: string): boolean {
  if (!search) {
    return true
  }

  return String(value ?? '')
    .toLowerCase()
    .includes(search.toLowerCase())
}

async function fetchStoreCollection(
  storeId: string,
  collectionName: string,
): Promise<Array<Record<string, unknown>>> {
  const snapshot = await getAdminFirestore()
    .collection('stores')
    .doc(storeId)
    .collection(collectionName)
    .limit(MAX_COLLECTION_FETCH)
    .get()

  return snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
    id: doc.id,
    ...doc.data(),
  }))
}

function filterByOperator<TRecord extends Record<string, unknown>>(
  items: TRecord[],
  operator = '',
) {
  if (!operator) {
    return items
  }

  return items.filter((item) =>
    [
      item.createdBy,
      item.userId,
      item.actor && typeof item.actor === 'object'
        ? (item.actor as Record<string, unknown>).id
        : '',
      item.actor && typeof item.actor === 'object'
        ? (item.actor as Record<string, unknown>).name
        : '',
      item.cashierName,
      item.courierName,
    ].some((value) => matchesText(value, operator)),
  )
}

function filterByModule<TRecord extends Record<string, unknown>>(items: TRecord[], module = '') {
  if (!module) {
    return items
  }

  return items.filter((item) =>
    [item.module, item.source, item.entityType, item.paymentMethod].some((value) =>
      matchesText(value, module),
    ),
  )
}

function buildRowsForType(
  type: ReportType,
  datasets: Record<string, Array<Record<string, unknown>>>,
) {
  switch (type) {
    case 'sales':
      return datasets.sales.map((item) => ({
        id: item.id,
        data: asDate(item.createdAt)?.toISOString() ?? '',
        operador: String(item.createdBy ?? ''),
        cliente: String((item.customerSnapshot as Record<string, unknown> | undefined)?.name ?? ''),
        formaPagamento: String(item.paymentMethod ?? ''),
        total: parseMoney(item.total),
        status: String(item.status ?? ''),
      }))
    case 'cash':
      return [
        ...datasets.financialEntries.map((item) => ({
          id: item.id,
          data: asDate(item.createdAt)?.toISOString() ?? '',
          tipo: 'entry',
          movimento: String(item.type ?? ''),
          descricao: String(item.description ?? ''),
          valor: parseMoney(item.amount),
          status: String(item.status ?? ''),
        })),
        ...datasets.financialClosures.map((item) => ({
          id: item.id,
          data: asDate(item.createdAt)?.toISOString() ?? '',
          tipo: 'closure',
          movimento: 'fechamento',
          descricao: String(item.cashierName ?? 'Fechamento'),
          valor: parseMoney(item.balance),
          status: 'closed',
        })),
      ]
    case 'deliveries':
      return datasets.externalOrders.map((item) => ({
        id: item.id,
        data: asDate(item.createdAt)?.toISOString() ?? '',
        codigo: String(item.displayId ?? item.externalOrderId ?? ''),
        merchantId: String(item.merchantId ?? ''),
        status: String(item.normalizedStatus ?? item.externalStatus ?? ''),
        entregador: String(item.courierName ?? ''),
        total: parseMoney(item.total),
      }))
    case 'operations':
    case 'audit':
      return datasets.auditLogs.map((item) => ({
        id: item.id,
        data: String(item.timestampUtc ?? ''),
        usuario: String(
          (item.actor as Record<string, unknown> | undefined)?.name ?? item.userId ?? 'Sistema',
        ),
        acao: String(item.action ?? ''),
        modulo: String(item.module ?? ''),
        entidade: String(item.entityType ?? ''),
        registro: String(item.entityId ?? ''),
        motivo: String(item.reason ?? ''),
      }))
    default:
      return []
  }
}

function buildSummary(type: ReportType, rows: Array<Record<string, unknown>>) {
  if (type === 'sales') {
    const total = rows.reduce((sum, row) => sum + parseMoney(row.total), 0)
    return {
      records: rows.length,
      totalSold: total,
      averageTicket: rows.length > 0 ? total / rows.length : 0,
    }
  }

  if (type === 'cash') {
    const total = rows.reduce((sum, row) => sum + parseMoney(row.valor), 0)
    return {
      records: rows.length,
      totalBalance: total,
    }
  }

  if (type === 'deliveries') {
    const delivered = rows.filter((row) =>
      String(row.status).toLowerCase().includes('deliver'),
    ).length
    return {
      records: rows.length,
      delivered,
      successRate: rows.length > 0 ? (delivered / rows.length) * 100 : 0,
    }
  }

  return {
    records: rows.length,
  }
}

async function buildChartPngBuffer(
  title: string,
  labels: string[],
  values: number[],
): Promise<Buffer> {
  const width = 820
  const height = 260
  const max = Math.max(...values, 1)
  const barWidth = Math.max(32, Math.floor((width - 120) / Math.max(values.length, 1)))
  const bars = values
    .map((value, index) => {
      const barHeight = Math.max(8, Math.round((value / max) * 120))
      const x = 60 + index * barWidth
      const y = 180 - barHeight
      const label = labels[index] ?? ''
      return `
        <rect x="${x}" y="${y}" width="${Math.max(barWidth - 14, 18)}" height="${barHeight}" rx="8" fill="#2563eb" />
        <text x="${x + 8}" y="205" font-size="11" fill="#475569">${label}</text>
        <text x="${x + 8}" y="${y - 6}" font-size="11" fill="#0f172a">${value}</text>
      `
    })
    .join('')

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff" />
      <text x="32" y="36" font-size="20" font-family="Arial" fill="#0f172a">${title}</text>
      <line x1="44" y1="184" x2="${width - 20}" y2="184" stroke="#cbd5e1" stroke-width="2" />
      ${bars}
    </svg>
  `

  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function buildPdfReport(
  reportTitle: string,
  rows: Array<Record<string, unknown>>,
  summary: Record<string, unknown>,
): Promise<Uint8Array> {
  const PDFDocument = (await import('pdfkit')).default
  const document = new PDFDocument({
    margin: 32,
    size: 'A4',
  })

  const chunks: Uint8Array[] = []
  document.on('data', (chunk: Uint8Array) => chunks.push(Buffer.from(chunk)))

  document.fontSize(18).text(reportTitle)
  document.moveDown(0.5)
  document.fontSize(10).fillColor('#475569').text(`Gerado em ${new Date().toISOString()}`)
  document.moveDown()

  Object.entries(summary).forEach(([key, value]) => {
    document
      .fontSize(11)
      .fillColor('#111827')
      .text(`${key}: ${typeof value === 'number' ? value.toFixed(2) : String(value)}`)
  })

  document.moveDown()
  document.fontSize(9).fillColor('#111827')

  rows.forEach((row, index) => {
    const line = Object.entries(row)
      .map(
        ([key, value]) =>
          `${key}=${typeof value === 'number' ? value.toFixed(2) : String(value ?? '')}`,
      )
      .join(' | ')

    document.text(line, {
      width: 520,
    })

    if ((index + 1) % 28 === 0) {
      document.addPage()
    }
  })

  document.end()

  return await new Promise((resolve, reject) => {
    document.on('end', () => resolve(Buffer.concat(chunks)))
    document.on('error', reject)
  })
}

async function buildExcelReport(
  reportTitle: string,
  rows: Array<Record<string, unknown>>,
  summary: Record<string, unknown>,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'NEXUS10'
  workbook.created = new Date()

  const summarySheet = workbook.addWorksheet('Resumo')
  summarySheet.columns = [
    { header: 'Indicador', key: 'label', width: 28 },
    { header: 'Valor', key: 'value', width: 18 },
  ]

  summarySheet.addRow({ label: 'Relatorio', value: reportTitle })
  Object.entries(summary).forEach(([key, value]) => {
    summarySheet.addRow({
      label: key,
      value: typeof value === 'number' ? Number(value.toFixed(2)) : String(value),
    })
  })

  const dataSheet = workbook.addWorksheet('Dados')
  const headers = Object.keys(rows[0] ?? { registro: '' })
  dataSheet.columns = headers.map((key) => ({
    header: key,
    key,
    width: 22,
  }))
  rows.forEach((row) => dataSheet.addRow(row))
  dataSheet.views = [{ state: 'frozen', ySplit: 1 }]

  const chartLabels = rows
    .slice(0, 8)
    .map((row) => String(row.id ?? row.registro ?? row.data ?? ''))
  const chartValues = rows
    .slice(0, 8)
    .map((row) => Number(row.total ?? row.valor ?? row.records ?? 0))

  if (chartLabels.length > 0) {
    const chartBuffer = await buildChartPngBuffer(reportTitle, chartLabels, chartValues)
    const imageId = workbook.addImage({
      base64: Buffer.from(chartBuffer).toString('base64'),
      extension: 'png',
    })

    summarySheet.addImage(imageId, {
      tl: { col: 3, row: 1 },
      ext: { width: 560, height: 180 },
    })
  }

  return new Uint8Array(await workbook.xlsx.writeBuffer())
}

async function uploadReportAsset(
  reportId: string,
  storeId: string,
  asset: GeneratedAsset,
  createdBy: string,
  expiresAt: string,
) {
  const bucket = getAdminStorageBucket()
  const storagePath = `reports/${storeId}/${reportId}/${asset.fileName}`
  const file = bucket.file(storagePath)

  await file.save(asset.buffer, {
    resumable: false,
    contentType: asset.contentType,
    metadata: {
      cacheControl: 'private, max-age=0, no-transform',
      metadata: {
        reportId,
        storeId,
        createdBy,
        expiresAt,
      },
    },
  })

  return {
    storagePath,
    contentType: asset.contentType,
    sizeBytes: asset.buffer.byteLength,
  }
}

async function collectDatasets(request: ReportRequest) {
  const { storeId, filters } = request
  const [sales, financialEntries, financialClosures, externalOrders, auditLogs] = await Promise.all(
    [
      fetchStoreCollection(storeId, 'sales'),
      fetchStoreCollection(storeId, 'financial_entries'),
      fetchStoreCollection(storeId, 'financial_closures'),
      fetchStoreCollection(storeId, 'external_orders'),
      fetchStoreCollection(storeId, 'audit_logs'),
    ],
  )

  return {
    sales: filterByModule(
      filterByOperator(
        sales.filter((item) => isWithinPeriod(item.createdAt, filters.startDate, filters.endDate)),
        filters.operator,
      ),
      filters.module,
    ),
    financialEntries: filterByOperator(
      financialEntries.filter((item) =>
        isWithinPeriod(item.createdAt, filters.startDate, filters.endDate),
      ),
      filters.operator,
    ),
    financialClosures: filterByOperator(
      financialClosures.filter((item) =>
        isWithinPeriod(item.createdAt, filters.startDate, filters.endDate),
      ),
      filters.operator,
    ),
    externalOrders: filterByOperator(
      externalOrders.filter((item) =>
        isWithinPeriod(item.createdAt ?? item.updatedAt, filters.startDate, filters.endDate),
      ),
      filters.operator,
    ),
    auditLogs: filterByModule(
      filterByOperator(
        auditLogs.filter((item) =>
          isWithinPeriod(item.timestampUtc ?? item.createdAt, filters.startDate, filters.endDate),
        ),
        filters.operator,
      ),
      filters.module,
    ),
  }
}

async function generateAsset(request: ReportRequest): Promise<GeneratedAsset> {
  const datasets = await collectDatasets(request)
  const rows = buildRowsForType(request.type, datasets)
  const summary = buildSummary(request.type, rows)
  const fileName = buildFileName(request.storeId, request.type, request.format)
  const reportTitle = `NEXUS10 ${request.type.toUpperCase()}`

  const buffer =
    request.format === 'pdf'
      ? await buildPdfReport(reportTitle, rows, summary)
      : await buildExcelReport(reportTitle, rows, summary)

  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new Error('Arquivo excede o limite operacional de 1MB.')
  }

  return {
    buffer,
    fileName,
    contentType:
      request.format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    summary,
  }
}

async function updateReportHistory(
  storeId: string,
  reportId: string,
  payload: Record<string, unknown>,
) {
  await getStoreReportsCollection(storeId).doc(reportId).set(payload, { merge: true })
}

async function processQueuedReport(request: ReportRequest & { reportId: string }) {
  const startedAt = Date.now()
  const expiresAt = getExpirationDate()

  try {
    await updateReportHistory(request.storeId, request.reportId, {
      status: 'processing',
      processingStartedAt: toIsoDate(new Date()),
    })

    const asset = await generateAsset(request)
    const uploaded = await uploadReportAsset(
      request.reportId,
      request.storeId,
      asset,
      request.actor.uid,
      expiresAt,
    )

    await updateReportHistory(request.storeId, request.reportId, {
      status: 'completed',
      fileName: asset.fileName,
      storagePath: uploaded.storagePath,
      contentType: uploaded.contentType,
      sizeBytes: uploaded.sizeBytes,
      summary: asset.summary,
      expiresAt,
      completedAt: toIsoDate(new Date()),
      durationMs: Date.now() - startedAt,
      downloadPath: `/api/reports/${request.reportId}/download?storeId=${request.storeId}`,
    })
  } catch (error) {
    await updateReportHistory(request.storeId, request.reportId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Falha ao gerar relatorio.',
      completedAt: toIsoDate(new Date()),
      durationMs: Date.now() - startedAt,
    })

    reportLogger.error(
      {
        context: 'reports.process',
        storeId: request.storeId,
        reportId: request.reportId,
        error: serializeError(error),
      },
      'Failed to process report',
    )
  }
}

export async function queueReportGeneration(request: ReportRequest): Promise<ReportHistoryRecord> {
  const reportId = buildReportId()
  const createdAt = toIsoDate(new Date())
  const record: ReportHistoryRecord = {
    id: reportId,
    storeId: request.storeId,
    type: request.type,
    format: request.format,
    status: 'queued',
    template: request.filters.template || 'default',
    filters: request.filters,
    createdBy: {
      uid: request.actor.uid ?? null,
      name: request.actor.operatorName ?? request.actor.displayName ?? request.actor.email ?? null,
      role: String(request.actor.role ?? ''),
    },
    fileName: null,
    storagePath: null,
    sizeBytes: null,
    contentType: null,
    summary: null,
    errorMessage: null,
    createdAt,
    completedAt: null,
    expiresAt: null,
    scheduledFor: request.filters.scheduledFor ?? null,
  }

  await getStoreReportsCollection(request.storeId).doc(reportId).set(record)
  setImmediate(() => {
    void processQueuedReport({
      ...request,
      reportId,
    })
  })

  return record
}

export async function listReportHistory(storeId: string, limit = 20) {
  const snapshot = await getStoreReportsCollection(storeId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()

  return snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
    id: doc.id,
    ...doc.data(),
  }))
}

export async function getReportDownload(storeId: string, reportId: string) {
  const snapshot = await getStoreReportsCollection(storeId).doc(reportId).get()

  if (!snapshot.exists) {
    return null
  }

  const data = snapshot.data() as Record<string, unknown>
  const storagePath = String(data.storagePath ?? '').trim()

  if (!storagePath) {
    return {
      status: String(data.status ?? 'queued'),
      fileName: String(data.fileName ?? `${reportId}.bin`),
      buffer: null,
      contentType: String(data.contentType ?? 'application/octet-stream'),
    }
  }

  const [buffer] = await getAdminStorageBucket().file(storagePath).download()

  return {
    status: String(data.status ?? 'completed'),
    fileName: String(data.fileName ?? `${reportId}.bin`),
    buffer: new Uint8Array(buffer),
    contentType: String(data.contentType ?? 'application/octet-stream'),
  }
}
