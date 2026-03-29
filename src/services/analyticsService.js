import { requestBackend } from './backendApi'

function buildQueryString(filters) {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value == null || value === '') {
      return
    }

    params.set(key, String(value))
  })

  return params.toString()
}

export async function getDashboardAnalytics(filters) {
  const queryString = buildQueryString(filters)
  return requestBackend(`/dashboard/analytics?${queryString}`, {
    method: 'GET',
    retries: 1,
    queueOffline: false,
  })
}
