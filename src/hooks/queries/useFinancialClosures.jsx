import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useToast } from '../useToast'
import { useErrorHandler } from '../useErrorHandler'
import { createFinancialClosure, listFinancialClosuresPage } from '../../services/finance'
import { queryKeys } from './queryKeys'
import { useQueryErrorFeedback } from './useQueryErrorFeedback'

export function useFinancialClosures({
  storeId,
  pageSize = 50,
  cursor = null,
  enabled = true,
} = {}) {
  const queryResult = useQuery({
    queryKey: queryKeys.finance.closures(storeId, { pageSize, cursorId: cursor?.id ?? null }),
    enabled: Boolean(storeId) && enabled,
    queryFn: () => listFinancialClosuresPage({ storeId, pageSize, cursor }),
  })

  useQueryErrorFeedback(queryResult.error)
  return queryResult
}

export function useFinancialClosureMutations({ storeId, tenantId } = {}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { handleError } = useErrorHandler()

  const createFinancialClosureMutation = useMutation({
    mutationKey: ['finance', 'closures', 'create', storeId],
    mutationFn: (values) => createFinancialClosure({ storeId, tenantId, values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all(storeId) })
      toast.success('Fechamento financeiro criado.')
    },
    onError: handleError,
  })

  return {
    createFinancialClosureMutation,
  }
}
