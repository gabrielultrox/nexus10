import { useEffect } from 'react'

import { useErrorHandler } from '../useErrorHandler'

export function useQueryErrorFeedback(error) {
  const { handleError } = useErrorHandler()

  useEffect(() => {
    if (!error) {
      return
    }

    handleError(error)
  }, [error, handleError])
}
