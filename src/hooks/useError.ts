import { useCallback, useMemo, useState } from 'react'

import { useToast } from './useToast'
import {
  captureErrorForMonitoring,
  getApiErrorDisplayModel,
  retryWithBackoff,
  toApiError,
  type IApiErrorContext,
} from '../services/apiErrorHandler'

interface IUseErrorOptions {
  autoToast?: boolean
  retries?: number
  context?: IApiErrorContext
}

/**
 * Hook padrao para capturar erro, emitir toast e repetir operacoes recuperaveis.
 */
export function useError(options: IUseErrorOptions = {}) {
  const { autoToast = true, retries = 1, context = {} } = options
  const toast = useToast()
  const [error, setError] = useState<unknown>(null)
  const [isHandlingError, setIsHandlingError] = useState(false)

  const errorModel = useMemo(() => (error ? getApiErrorDisplayModel(error) : null), [error])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const captureError = useCallback(
    (nextError: unknown, nextContext: IApiErrorContext = {}) => {
      const normalized = captureErrorForMonitoring(nextError, {
        ...context,
        ...nextContext,
      })

      setError(normalized)

      if (autoToast) {
        toast.error(getApiErrorDisplayModel(normalized).message)
      }

      return normalized
    },
    [autoToast, context, toast],
  )

  const runWithErrorHandling = useCallback(
    async <T>(
      operation: () => Promise<T>,
      nextOptions: {
        retries?: number
        toastOnError?: boolean
        context?: IApiErrorContext
      } = {},
    ) => {
      setIsHandlingError(true)

      try {
        const result = await retryWithBackoff(operation, {
          retries: nextOptions.retries ?? retries,
        })
        clearError()
        return result
      } catch (caughtError) {
        const normalized = toApiError(caughtError, {
          ...context,
          ...nextOptions.context,
        })

        setError(normalized)
        captureErrorForMonitoring(normalized, {
          ...context,
          ...nextOptions.context,
        })

        if (autoToast && nextOptions.toastOnError !== false) {
          toast.error(getApiErrorDisplayModel(normalized).message)
        }

        throw normalized
      } finally {
        setIsHandlingError(false)
      }
    },
    [autoToast, clearError, context, retries, toast],
  )

  return {
    error,
    errorModel,
    isHandlingError,
    clearError,
    captureError,
    runWithErrorHandling,
  }
}
