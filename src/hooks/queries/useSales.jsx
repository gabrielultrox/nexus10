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

export function useSales({ storeId, pageSize = 50, cursor = null, enabled = true } = {}) {
  const queryResult = useQuery({
    queryKey: queryKeys.sales.list(storeId, { pageSize, cursorId: cursor?.id ?? null }),
    enabled: Boolean(storeId) && enabled,
    queryFn: () => listSalesPage({ storeId, pageSize, cursor }),
  })

  useQueryErrorFeedback(queryResult.error)
  return queryResult
}

export function useSale({ storeId, saleId, enabled = true } = {}) {
  const queryResult = useQuery({
    queryKey: queryKeys.sales.detail(storeId, saleId),
    enabled: Boolean(storeId && saleId) && enabled,
    queryFn: () => getSaleById({ storeId, saleId }),
  })

  useQueryErrorFeedback(queryResult.error)
  return queryResult
}

export function useSaleMutations({ storeId, tenantId, createdBy = null } = {}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { handleError } = useErrorHandler()

  const invalidateSales = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.sales.all(storeId) })
  }

  const createDirectSaleMutation = useMutation({
    mutationKey: ['sales', 'create-direct', storeId],
    mutationFn: (values) => createDirectSale({ storeId, tenantId, values, createdBy }),
    onSuccess: () => {
      invalidateSales()
      toast.success('Venda criada.')
    },
    onError: handleError,
  })

  const createSaleFromOrderMutation = useMutation({
    mutationKey: ['sales', 'create-from-order', storeId],
    mutationFn: ({ orderId, values = {} }) => createSaleFromOrder({
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
    mutationFn: (saleId) => deleteSale({ storeId, saleId }),
    onSuccess: (_result, saleId) => {
      invalidateSales()
      queryClient.removeQueries({ queryKey: queryKeys.sales.detail(storeId, saleId) })
      toast.success('Venda excluida.')
    },
    onError: handleError,
  })

  const updateSaleStatusMutation = useMutation({
    mutationKey: ['sales', 'status', storeId],
    mutationFn: ({ saleId, status, actor = null }) => updateSaleStatus({ storeId, saleId, status, actor }),
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
