import { requestBackend } from './backendApi'

function buildQueryString(filters = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value == null) {
      return
    }

    const normalizedValue = String(value).trim()

    if (!normalizedValue) {
      return
    }

    searchParams.set(key, normalizedValue)
  })

  return searchParams.toString()
}

export async function listAdminAuditLogs(filters = {}) {
  const queryString = buildQueryString(filters)
  const path = queryString ? `/admin/audit-logs?${queryString}` : '/admin/audit-logs'
  return requestBackend(path)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export async function listAllAdminAuditLogs(filters = {}) {
  const limit = 200
  const firstPage = await listAdminAuditLogs({
    ...filters,
    page: 1,
    limit,
  })

  const pages = firstPage.pagination?.pages ?? 0

  if (pages <= 1) {
    return firstPage.items ?? []
  }

  const remainingPages = await Promise.all(
    Array.from({ length: pages - 1 }, (_value, index) =>
      listAdminAuditLogs({
        ...filters,
        page: index + 2,
        limit,
      }),
    ),
  )

  return [
    ...(firstPage.items ?? []),
    ...remainingPages.flatMap((pageResult) => pageResult.items ?? []),
  ]
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? '')
  return `"${stringValue.replaceAll('"', '""')}"`
}

export function buildAuditLogsCsv(items = []) {
  const rows = [
    [
      'Data UTC',
      'Data local',
      'Usuario',
      'Acao',
      'Modulo',
      'Entidade',
      'Registro',
      'Loja',
      'Motivo',
      'Descricao',
      'IP',
      'Request ID',
    ],
    ...items.map((item) => [
      item.timestampUtc ?? item.createdAt ?? '',
      item.timestampLocal ?? '',
      item.actorName ?? item.userId ?? '',
      item.action ?? '',
      item.module ?? '',
      item.entityType ?? item.resource ?? '',
      item.entityId ?? item.resourceId ?? '',
      item.storeId ?? '',
      item.reason ?? '',
      item.description ?? '',
      item.ip ?? '',
      item.requestId ?? '',
    ]),
  ]

  return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n')
}

export function buildAuditLogsExcel(items = []) {
  const header = [
    'Data UTC',
    'Data local',
    'Usuario',
    'Acao',
    'Modulo',
    'Entidade',
    'Registro',
    'Loja',
    'Motivo',
    'Descricao',
    'IP',
    'Request ID',
  ]
  const rows = items.map((item) => [
    item.timestampUtc ?? item.createdAt ?? '',
    item.timestampLocal ?? '',
    item.actorName ?? item.userId ?? '',
    item.action ?? '',
    item.module ?? '',
    item.entityType ?? item.resource ?? '',
    item.entityId ?? item.resourceId ?? '',
    item.storeId ?? '',
    item.reason ?? '',
    item.description ?? '',
    item.ip ?? '',
    item.requestId ?? '',
  ])

  const htmlRows = [header, ...rows]
    .map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`)
    .join('')

  return `<html><body><table>${htmlRows}</table></body></html>`
}

export function buildAuditLogsPdfHtml(items = []) {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.timestampLocal ?? item.timestampUtc ?? item.createdAt ?? '')}</td>
          <td>${escapeHtml(item.actorName ?? item.userId ?? '')}</td>
          <td>${escapeHtml(item.action ?? '')}</td>
          <td>${escapeHtml(item.module ?? '')}</td>
          <td>${escapeHtml(item.entityType ?? item.resource ?? '')}</td>
          <td>${escapeHtml(item.entityId ?? item.resourceId ?? '')}</td>
          <td>${escapeHtml(item.description ?? '')}</td>
        </tr>
      `,
    )
    .join('')

  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Audit Log</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #f3f4f6; }
      </style>
    </head>
    <body>
      <h1>Audit Log</h1>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Usuario</th>
            <th>Acao</th>
            <th>Modulo</th>
            <th>Entidade</th>
            <th>Registro</th>
            <th>Descricao</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
  </html>`
}
