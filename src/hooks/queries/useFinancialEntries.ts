import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useToast } from '../useToast'
import { useErrorHandler } from '../useErrorHandler'
import { createManualExpense, listFinancialEntriesPage } from '../../services/finance'
import { queryKeys } from './queryKeys'
import { useQueryErrorFeedback } from './useQueryErrorFeedback'
import type { IQueryCursor } from './useOrders'

export interface IFinancialEntryRecord extends Record<string, unknown> {
  id: string
  type?: 'entrada' | 'saida'
  source?: 'venda' | 'manual'
  description?: string
  amount?: number
  cashierName?: string
  occurredAt?: string
  status?: string
}

export interface IFinancialEntryListResult<TEntry = IFinancialEntryRecord> {
  items: TEntry[]
  nextCursor: IQueryCursor | null
  hasMore: boolean
}

export interface IUseFinancialEntriesOptions {
  storeId?: string | null
  pageSize?: number
  cursor?: IQueryCursor | null
  enabled?: boolean
}

const listFinancialEntriesPageTyped = listFinancialEntriesPage as (args: {
  storeId?: string | null
  pageSize?: number
  cursor?: IQueryCursor | null
}) => Promise<IFinancialEntryListResult>

const createManualExpenseTyped = createManualExpense as (args: {
  storeId?: string | null
  tenantId?: string | null
  values: Record<string, unknown>
}) => Promise<string>

/**
 * Query paginada de lancamentos financeiros.
 */
export function useFinancialEntries({
  storeId,
  pageSize = 50,
  cursor = null,
  enabled = true,
}: IUseFinancialEntriesOptions = {}) {
  const queryResult = useQuery<IFinancialEntryListResult>({
    queryKey: queryKeys.finance.entries(storeId, { pageSize, cursorId: cursor?.id ?? null }),
    enabled: Boolean(storeId) && enabled,
    queryFn: () => listFinancialEntriesPageTyped({ storeId, pageSize, cursor }),
  })

  useQueryErrorFeedback(queryResult.error)
  return queryResult
}

/**
 * Mutations de lancamentos financeiros manuais.
 */
export function useFinancialEntryMutations({
  storeId,
  tenantId,
}: {
  storeId?: string | null
  tenantId?: string | null
} = {}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { handleError } = useErrorHandler()

  const createFinancialEntryMutation = useMutation({
    mutationKey: ['finance', 'entries', 'create', storeId],
    mutationFn: (values: Record<string, unknown>) =>
      createManualExpenseTyped({ storeId, tenantId, values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all(storeId) })
      toast.success('Lancamento financeiro criado.')
    },
    onError: handleError,
  })

  return {
    createFinancialEntryMutation,
  }
}
