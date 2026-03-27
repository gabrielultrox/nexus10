import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { captureErrorForMonitoring } from './apiErrorHandler'
import { ErrorCode, ErrorHandler } from './errorHandler'

function shouldRetry(failureCount: number, error: unknown) {
  const normalized = ErrorHandler.normalize(error)

  if (failureCount >= 2) {
    return false
  }

  if (
    normalized.code === ErrorCode.VALIDATION_ERROR ||
    normalized.code === ErrorCode.FORBIDDEN ||
    normalized.code === ErrorCode.UNAUTHORIZED ||
    normalized.status === 400 ||
    normalized.status === 401 ||
    normalized.status === 403 ||
    normalized.status === 404
  ) {
    return false
  }

  return ErrorHandler.isRecoverable(normalized)
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
  queryCache: new QueryCache({
    onError(error, query) {
      const normalized = ErrorHandler.normalize(error)
      captureErrorForMonitoring(normalized, {
        feature: 'react-query',
        action: 'query',
        queryKey: JSON.stringify(query.queryKey),
      })
    },
  }),
  mutationCache: new MutationCache({
    onError(error, _variables, _context, mutation) {
      const normalized = ErrorHandler.normalize(error)
      captureErrorForMonitoring(normalized, {
        feature: 'react-query',
        action: 'mutation',
        mutationKey: JSON.stringify(mutation.options.mutationKey ?? []),
      })
    },
  }),
})
