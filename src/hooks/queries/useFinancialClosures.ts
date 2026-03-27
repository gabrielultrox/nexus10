import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useToast } from '../useToast'
import { useErrorHandler } from '../useErrorHandler'
import { createFinancialClosure, listFinancialClosuresPage } from '../../services/finance'
import { queryKeys } from './queryKeys'
import { useQueryErrorFeedback } from './useQueryErrorFeedback'
import type { IQueryCursor } from './useOrders'

export interface IFinancialClosureRecord extends Record<string, unknown> {
  id: string
  cashierName?: string
  startDate?: string
  endDate?: string
  balance?: number
}

export interface IFinancialClosureListResult<TClosure = IFinancialClosureRecord> {
  items: TClosure[]
  nextCursor: IQueryCursor | null
  hasMore: boolean
}

export interface IUseFinancialClosuresOptions {
  storeId?: string | null
  pageSize?: number
  cursor?: IQueryCursor | null
  enabled?: boolean
}

const listFinancialClosuresPageTyped = listFinancialClosuresPage as (args: {
  storeId?: string | null
  pageSize?: number
  cursor?: IQueryCursor | null
}) => Promise<IFinancialClosureListResult>

const createFinancialClosureTyped = createFinancialClosure as (args: {
  storeId?: string | null
  tenantId?: string | null
  values: Record<string, unknown>
}) => Promise<string>

/**
 * Query paginada de fechamentos financeiros.
 */
export function useFinancialClosures({
  storeId,
  pageSize = 50,
  cursor = null,
  enabled = true,
}: IUseFinancialClosuresOptions = {}) {
  const queryResult = useQuery<IFinancialClosureListResult>({
    queryKey: queryKeys.finance.closures(storeId, { pageSize, cursorId: cursor?.id ?? null }),
    enabled: Boolean(storeId) && enabled,
    queryFn: () => listFinancialClosuresPageTyped({ storeId, pageSize, cursor }),
  })

  useQueryErrorFeedback(queryResult.error)
  return queryResult
}

/**
 * Mutations de fechamento financeiro.
 */
export function useFinancialClosureMutations({
  storeId,
  tenantId,
}: {
  storeId?: string | null
  tenantId?: string | null
} = {}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { handleError } = useErrorHandler()

  const createFinancialClosureMutation = useMutation({
    mutationKey: ['finance', 'closures', 'create', storeId],
    mutationFn: (values: Record<string, unknown>) =>
      createFinancialClosureTyped({ storeId, tenantId, values }),
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
