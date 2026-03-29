import { ensureRemoteSession, firebaseReady } from './firebase'
import { requestBackend } from './backendApi'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '')

async function getAuthorizationHeader() {
  if (!firebaseReady) {
    return null
  }

  const user = await ensureRemoteSession().catch(() => null)
  const token = user ? await user.getIdToken().catch(() => '') : ''
  return token ? `Bearer ${token}` : null
}

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') {
      return
    }

    searchParams.set(key, String(value))
  })

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export function buildDefaultReportFilters() {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - 29)

  return {
    type: 'sales',
    format: 'pdf',
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    operator: '',
    module: '',
    template: 'default',
    scheduledFor: '',
  }
}

export async function generateReport(payload) {
  return requestBackend('/reports/generate', {
    method: 'POST',
    body: payload,
  })
}

export async function listReportHistory({ storeId, limit = 20 }) {
  return requestBackend(`/reports/history${buildQuery({ storeId, limit })}`, {
    method: 'GET',
    queueOffline: false,
  })
}

export async function downloadReportFile({ reportId, storeId, fileName }) {
  const authorization = await getAuthorizationHeader()
  const response = await fetch(
    `${apiBaseUrl}/reports/${reportId}/download${buildQuery({ storeId })}`,
    {
      method: 'GET',
      headers: {
        ...(authorization ? { Authorization: authorization } : {}),
      },
    },
  )

  if (!response.ok) {
    let message = 'Nao foi possivel baixar o relatorio.'

    try {
      const payload = await response.json()
      message = payload.error ?? message
    } catch {
      // noop
    }

    throw new Error(message)
  }

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName || response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || `${reportId}`
  document.body.append(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
