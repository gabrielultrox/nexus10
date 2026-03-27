import { useCallback } from 'react'

import { useToast } from './useToast'
import { AppError, ErrorHandler, ErrorSeverity } from '../services/errorHandler'

interface IUseErrorHandlerOptions {
  showToast?: boolean
  logError?: boolean
  onError?: (error: AppError) => void
}

export function useErrorHandler(options: IUseErrorHandlerOptions = {}) {
  const { showToast = true, logError = true, onError } = options
  const toast = useToast()

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
