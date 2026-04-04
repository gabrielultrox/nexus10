import { LOCAL_RECORDS_EVENT, loadLocalRecords, saveLocalRecords } from './localAccess'

const MALOTE_STORAGE_PREFIX = 'nexus-occurrence-malote'

function getStorageKey(storeId) {
  return `${MALOTE_STORAGE_PREFIX}:${storeId || 'local'}`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? '')
  return `"${stringValue.replaceAll('"', '""')}"`
}

function formatDateTime(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '--'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function toIsoDateTime(value) {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function getActorName(session) {
  return session?.operatorName ?? session?.displayName ?? 'Operador local'
}

function normalizeItems(items = []) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.updatedAt ?? left.printedAt ?? left.createdAt ?? 0).getTime()
    const rightTime = new Date(right.updatedAt ?? right.printedAt ?? right.createdAt ?? 0).getTime()
    return rightTime - leftTime
  })
}

function buildEntryId() {
  return `malote-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function buildProtocolCode() {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(
    2,
    '0',
  )}`
  return `MAL-${stamp}`
}

export function getOccurrenceMaloteDefaultReceivedAt() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function loadOccurrenceMaloteHistory(storeId) {
  return normalizeItems(loadLocalRecords(getStorageKey(storeId), []))
}

export function subscribeToOccurrenceMaloteHistory(storeId, onData) {
  const storageKey = getStorageKey(storeId)

  function emit() {
    onData(loadOccurrenceMaloteHistory(storeId))
  }

  emit()

  function handleChange(event) {
    if (event.detail?.storageKey === storageKey) {
      emit()
    }
  }

  window.addEventListener(LOCAL_RECORDS_EVENT, handleChange)

  return () => {
    window.removeEventListener(LOCAL_RECORDS_EVENT, handleChange)
  }
}

export function buildOccurrenceMalotePrintPayload(entry, session) {
  return {
    documentTitle: 'Ocorrencia para malote',
    subtitle: 'Encaminhamento interno para Financeiro / RH',
    meta: String(entry?.status ?? '').trim() || 'Em triagem',
    destinationSector: entry?.destinationSector ?? 'Financeiro / RH',
    category: entry?.category ?? 'Ocorrencia operacional',
    title: entry?.title ?? `Ocorrencia ${entry?.reference ?? entry?.code ?? 'Sem codigo'}`,
    reference: entry?.reference ?? entry?.code ?? '',
    amount: entry?.amount ?? '',
    operatorName: entry?.operatorName ?? getActorName(session),
    occurredAt: toIsoDateTime(
      entry?.occurredAt ?? entry?.createdAtClient ?? entry?.updatedAtClient,
    ),
    description: entry?.description ?? entry?.type ?? 'Ocorrencia operacional',
    footer:
      entry?.protocolCode && entry?.receivedBy
        ? `Protocolo ${entry.protocolCode} - Recebido por ${entry.receivedBy}`
        : 'Documento para envio no malote interno.',
  }
}

export function upsertOccurrenceMaloteEntry({ storeId, tenantId, record, session }) {
  const items = loadOccurrenceMaloteHistory(storeId)
  const actorName = getActorName(session)
  const nowIso = new Date().toISOString()
  const sourceRecordId = record?.id ?? ''
  const existing = items.find((item) => item.sourceRecordId === sourceRecordId)

  const baseEntry = {
    storeId: storeId ?? null,
    tenantId: tenantId ?? null,
    sourceRecordId,
    code: String(record?.code ?? '').trim(),
    type: String(record?.type ?? '').trim(),
    owner: String(record?.owner ?? '').trim() || actorName,
    status: String(record?.status ?? '').trim() || 'Em triagem',
    description: String(record?.type ?? '').trim(),
    destinationSector: 'Financeiro / RH',
    category: 'Ocorrencia operacional',
    title: `Ocorrencia ${String(record?.code ?? '').trim() || 'sem codigo'}`,
    reference: String(record?.code ?? '').trim(),
    amount: '',
    cashierName: String(record?.owner ?? '').trim() || actorName,
    operatorName: actorName,
    occurredAt: toIsoDateTime(record?.createdAtClient ?? record?.updatedAtClient ?? nowIso),
    printedAt: nowIso,
    updatedAt: nowIso,
  }

  const nextItems = existing
    ? items.map((item) =>
        item.id === existing.id
          ? {
              ...item,
              ...baseEntry,
              createdAt: item.createdAt ?? nowIso,
              printCount: Number(item.printCount ?? 1) + 1,
            }
          : item,
      )
    : [
        {
          id: buildEntryId(),
          ...baseEntry,
          createdAt: nowIso,
          printCount: 1,
          protocolCode: '',
          receivedBy: '',
          receivedAt: '',
          digitalSignature: '',
          notes: '',
        },
        ...items,
      ]

  saveLocalRecords(getStorageKey(storeId), normalizeItems(nextItems))
}

export function syncOccurrenceMaloteStatus({ storeId, sourceRecordId, status }) {
  if (!sourceRecordId) {
    return
  }

  const items = loadOccurrenceMaloteHistory(storeId)
  const nextItems = items.map((item) =>
    item.sourceRecordId === sourceRecordId
      ? {
          ...item,
          status: String(status ?? '').trim() || item.status,
          updatedAt: new Date().toISOString(),
        }
      : item,
  )

  saveLocalRecords(getStorageKey(storeId), normalizeItems(nextItems))
}

export function attachOccurrenceMaloteReceipt({ storeId, entryId, values, session }) {
  const protocolCode = String(values?.protocolCode ?? '').trim() || buildProtocolCode()
  const receivedBy = String(values?.receivedBy ?? '').trim()
  const digitalSignature = String(values?.digitalSignature ?? '').trim()

  if (!receivedBy) {
    throw new Error('Informe quem recebeu o malote.')
  }

  if (!digitalSignature) {
    throw new Error('Informe a assinatura digital ou identificacao do recebimento.')
  }

  const items = loadOccurrenceMaloteHistory(storeId)
  const actorName = getActorName(session)
  const nowIso = new Date().toISOString()

  const nextItems = items.map((item) =>
    item.id === entryId
      ? {
          ...item,
          protocolCode,
          receivedBy,
          receivedAt: toIsoDateTime(values?.receivedAt || nowIso),
          digitalSignature,
          notes: String(values?.notes ?? '').trim(),
          receiptActor: actorName,
          updatedAt: nowIso,
        }
      : item,
  )

  saveLocalRecords(getStorageKey(storeId), normalizeItems(nextItems))
}

export function buildOccurrenceMaloteExcel(items = []) {
  const header = [
    'Codigo',
    'Titulo',
    'Tipo',
    'Operador responsavel',
    'Status',
    'Destino',
    'Impresso em',
    'Protocolo',
    'Recebido por',
    'Recebido em',
    'Assinatura digital',
    'Observacoes',
  ]
  const rows = items.map((item) => [
    item.code ?? '',
    item.title ?? '',
    item.type ?? '',
    item.owner ?? '',
    item.status ?? '',
    item.destinationSector ?? '',
    formatDateTime(item.printedAt),
    item.protocolCode ?? '',
    item.receivedBy ?? '',
    formatDateTime(item.receivedAt),
    item.digitalSignature ?? '',
    item.notes ?? '',
  ])

  const htmlRows = [header, ...rows]
    .map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`)
    .join('')

  return `<html><body><table>${htmlRows}</table></body></html>`
}

export function buildOccurrenceMaloteCsv(items = []) {
  const rows = [
    [
      'Codigo',
      'Titulo',
      'Tipo',
      'Operador responsavel',
      'Status',
      'Destino',
      'Impresso em',
      'Protocolo',
      'Recebido por',
      'Recebido em',
      'Assinatura digital',
      'Observacoes',
    ],
    ...items.map((item) => [
      item.code ?? '',
      item.title ?? '',
      item.type ?? '',
      item.owner ?? '',
      item.status ?? '',
      item.destinationSector ?? '',
      formatDateTime(item.printedAt),
      item.protocolCode ?? '',
      item.receivedBy ?? '',
      formatDateTime(item.receivedAt),
      item.digitalSignature ?? '',
      item.notes ?? '',
    ]),
  ]

  return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n')
}

export function buildOccurrenceMalotePdfHtml(items = []) {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.code ?? '')}</td>
          <td>${escapeHtml(item.title ?? '')}</td>
          <td>${escapeHtml(item.owner ?? '')}</td>
          <td>${escapeHtml(item.status ?? '')}</td>
          <td>${escapeHtml(item.protocolCode ?? '')}</td>
          <td>${escapeHtml(item.receivedBy ?? '')}</td>
          <td>${escapeHtml(formatDateTime(item.receivedAt))}</td>
          <td>${escapeHtml(item.digitalSignature ?? '')}</td>
        </tr>
      `,
    )
    .join('')

  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Historico de ocorrencias</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
        h1 { margin-bottom: 4px; }
        p { color: #4b5563; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #f3f4f6; }
      </style>
    </head>
    <body>
      <h1>Historico de ocorrencias</h1>
      <p>Relatorio de ocorrencias encaminhadas no malote interno.</p>
      <table>
        <thead>
          <tr>
            <th>Codigo</th>
            <th>Titulo</th>
            <th>Operador responsavel</th>
            <th>Status</th>
            <th>Protocolo</th>
            <th>Recebido por</th>
            <th>Recebido em</th>
            <th>Assinatura digital</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
  </html>`
}
