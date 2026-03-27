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
    ['Data', 'Ator', 'Acao', 'Recurso', 'Registro', 'Loja', 'Descricao'],
    ...items.map((item) => [
      item.createdAt ?? '',
      item.actorName ?? '',
      item.action ?? '',
      item.resource ?? '',
      item.resourceId ?? '',
      item.storeId ?? '',
      item.description ?? '',
    ]),
  ]

  return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n')
}
