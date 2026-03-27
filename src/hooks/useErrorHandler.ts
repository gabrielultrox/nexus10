import { useCallback } from 'react'

import { useToast } from './useToast.jsx'
import { AppError, ErrorHandler, ErrorSeverity } from '@services/errorHandler'

interface IUseErrorHandlerOptions {
  showToast?: boolean
  logError?: boolean
  onError?: (error: AppError) => void
}

interface IToastApi {
  error: (message: string, options?: Record<string, unknown>) => string
  warning: (message: string, options?: Record<string, unknown>) => string
  info: (message: string, options?: Record<string, unknown>) => string
}

export function useErrorHandler(options: IUseErrorHandlerOptions = {}) {
  const { showToast = true, logError = true, onError } = options
  const toast = useToast() as IToastApi

  const handleError = useCallback(
    (error: unknown) => {
      const normalized = ErrorHandler.normalize(error)

      if (logError) {
        normalized.log()
      }

      onError?.(normalized)

      if (showToast) {
        const message = ErrorHandler.getUserMessage(normalized)

        if (
          normalized.severity === ErrorSeverity.CRITICAL ||
          normalized.severity === ErrorSeverity.HIGH
        ) {
          toast.error(message)
        } else if (normalized.severity === ErrorSeverity.MEDIUM) {
          toast.warning(message)
        } else {
          toast.info(message)
        }
      }

      return normalized
    },
    [logError, onError, showToast, toast],
  )

  const tryCatch = useCallback(
    async <T>(operation: Promise<T> | (() => Promise<T>)) => {
      try {
        const task = typeof operation === 'function' ? (operation as () => Promise<T>)() : operation

        return await task
      } catch (error) {
        throw handleError(error)
      }
    },
    [handleError],
  )

  return {
    handleError,
    tryCatch,
  }
}
