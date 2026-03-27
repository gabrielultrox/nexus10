import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useToast } from '../useToast'
import { useErrorHandler } from '../useErrorHandler'
import {
  createDirectSale,
  createSaleFromOrder,
  deleteSale,
  getSaleById,
  listSalesPage,
  updateSaleStatus,
} from '../../services/sales'
import { queryKeys } from './queryKeys'
import { useQueryErrorFeedback } from './useQueryErrorFeedback'
import type { IQueryCursor } from './useOrders'

export interface ISaleRecord extends Record<string, unknown> {
  id: string
  status?: string
  domainStatus?: string
  total?: number
  channelLabel?: string
}

export interface ISaleListResult<TSale = ISaleRecord> {
  items: TSale[]
  nextCursor: IQueryCursor | null
  hasMore: boolean
}

export interface IUseSalesOptions {
  storeId?: string | null
  pageSize?: number
  cursor?: IQueryCursor | null
  enabled?: boolean
}

export interface ISaleMutationOptions {
  storeId?: string | null
  tenantId?: string | null
  createdBy?: string | null
}

const listSalesPageTyped = listSalesPage as (args: {
  storeId?: string | null
  pageSize?: number
  cursor?: IQueryCursor | null
}) => Promise<ISaleListResult>

const getSaleByIdTyped = getSaleById as (args: {
  storeId?: string | null
  saleId?: string | null
}) => Promise<ISaleRecord | null>

const createDirectSaleTyped = createDirectSale as (args: {
  storeId?: string | null
  tenantId?: string | null
  values: Record<string, unknown>
  createdBy?: string | null
}) => Promise<string>

const createSaleFromOrderTyped = createSaleFromOrder as (args: {
  storeId?: string | null
  tenantId?: string | null
  orderId: string
  values?: Record<string, unknown>
  createdBy?: string | null
}) => Promise<string>

const deleteSaleTyped = deleteSale as (args: {
  storeId?: string | null
  saleId: string
}) => Promise<string>

const updateSaleStatusTyped = updateSaleStatus as (args: {
  storeId?: string | null
  saleId: string
  status: string
  actor?: string | null
}) => Promise<string>

/**
 * Query paginada de vendas.
 */
export function useSales({
  storeId,
  pageSize = 50,
  cursor = null,
  enabled = true,
}: IUseSalesOptions = {}) {
  const queryResult = useQuery<ISaleListResult>({
    queryKey: queryKeys.sales.list(storeId, { pageSize, cursorId: cursor?.id ?? null }),
    enabled: Boolean(storeId) && enabled,
    queryFn: () => listSalesPageTyped({ storeId, pageSize, cursor }),
  })

  useQueryErrorFeedback(queryResult.error)
  return queryResult
}

/**
 * Query de detalhe de venda.
 */
export function useSale({
  storeId,
  saleId,
  enabled = true,
}: IUseSalesOptions & { saleId?: string | null } = {}) {
  const queryResult = useQuery<ISaleRecord | null>({
    queryKey: queryKeys.sales.detail(storeId, saleId),
    enabled: Boolean(storeId && saleId) && enabled,
    queryFn: () => getSaleByIdTyped({ storeId, saleId }),
  })

  useQueryErrorFeedback(queryResult.error)
  return queryResult
}

/**
 * Mutations de vendas com feedback centralizado.
 */
export function useSaleMutations({
  storeId,
  tenantId,
  createdBy = null,
}: ISaleMutationOptions = {}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { handleError } = useErrorHandler()

  const invalidateSales = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.sales.all(storeId) })
  }

  const createDirectSaleMutation = useMutation({
    mutationKey: ['sales', 'create-direct', storeId],
    mutationFn: (values: Record<string, unknown>) =>
      createDirectSaleTyped({ storeId, tenantId, values, createdBy }),
    onSuccess: () => {
      invalidateSales()
      toast.success('Venda criada.')
    },
    onError: handleError,
  })

  const createSaleFromOrderMutation = useMutation({
    mutationKey: ['sales', 'create-from-order', storeId],
    mutationFn: ({ orderId, values = {} }: { orderId: string; values?: Record<string, unknown> }) =>
      createSaleFromOrderTyped({
        storeId,
        tenantId,
        orderId,
        values,
        createdBy,
      }),
    onSuccess: () => {
      invalidateSales()
      toast.success('Venda gerada a partir do pedido.')
    },
    onError: handleError,
  })

  const deleteSaleMutation = useMutation({
    mutationKey: ['sales', 'delete', storeId],
    mutationFn: (saleId: string) => deleteSaleTyped({ storeId, saleId }),
    onSuccess: (_result, saleId) => {
      invalidateSales()
      queryClient.removeQueries({ queryKey: queryKeys.sales.detail(storeId, saleId) })
      toast.success('Venda excluida.')
    },
    onError: handleError,
  })

  const updateSaleStatusMutation = useMutation({
    mutationKey: ['sales', 'status', storeId],
    mutationFn: ({
      saleId,
      status,
      actor = null,
    }: {
      saleId: string
      status: string
      actor?: string | null
    }) => updateSaleStatusTyped({ storeId, saleId, status, actor }),
    onSuccess: (_result, variables) => {
      invalidateSales()
      queryClient.invalidateQueries({ queryKey: queryKeys.sales.detail(storeId, variables.saleId) })
      toast.success('Status da venda atualizado.')
    },
    onError: handleError,
  })

  return {
    createDirectSaleMutation,
    createSaleFromOrderMutation,
    deleteSaleMutation,
    updateSaleStatusMutation,
  }
}
