import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useToast } from '../useToast'
import { useErrorHandler } from '../useErrorHandler'
import {
  createOrder,
  deleteOrder,
  getOrderById,
  listOrdersPage,
  updateOrder,
  updateOrderStatus,
} from '../../services/orders'
import { queryKeys } from './queryKeys'
import { useQueryErrorFeedback } from './useQueryErrorFeedback'

export function useOrders({ storeId, pageSize = 50, cursor = null, enabled = true } = {}) {
  const queryResult = useQuery({
    queryKey: queryKeys.orders.list(storeId, { pageSize, cursorId: cursor?.id ?? null }),
    enabled: Boolean(storeId) && enabled,
    queryFn: () => listOrdersPage({ storeId, pageSize, cursor }),
  })

  useQueryErrorFeedback(queryResult.error)
  return queryResult
}

export function useOrder({ storeId, orderId, enabled = true } = {}) {
  const queryResult = useQuery({
    queryKey: queryKeys.orders.detail(storeId, orderId),
    enabled: Boolean(storeId && orderId) && enabled,
    queryFn: () => getOrderById({ storeId, orderId }),
  })

  useQueryErrorFeedback(queryResult.error)
  return queryResult
}

export function useOrderMutations({ storeId, tenantId, createdBy = null } = {}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { handleError } = useErrorHandler()

  const invalidateOrders = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.all(storeId) })
  }

  const createOrderMutation = useMutation({
    mutationKey: ['orders', 'create', storeId],
    mutationFn: (values) => createOrder({ storeId, tenantId, values, createdBy }),
    onSuccess: () => {
      invalidateOrders()
      toast.success('Pedido criado.')
    },
    onError: handleError,
  })

  const updateOrderMutation = useMutation({
    mutationKey: ['orders', 'update', storeId],
    mutationFn: ({ orderId, values }) => updateOrder({ storeId, orderId, values }),
    onSuccess: (_result, variables) => {
      invalidateOrders()
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(storeId, variables.orderId) })
      toast.success('Pedido atualizado.')
    },
    onError: handleError,
  })

  const deleteOrderMutation = useMutation({
    mutationKey: ['orders', 'delete', storeId],
    mutationFn: (orderId) => deleteOrder({ storeId, orderId }),
    onSuccess: (_result, orderId) => {
      invalidateOrders()
      queryClient.removeQueries({ queryKey: queryKeys.orders.detail(storeId, orderId) })
      toast.success('Pedido excluido.')
    },
    onError: handleError,
  })

  const updateOrderStatusMutation = useMutation({
    mutationKey: ['orders', 'status', storeId],
    mutationFn: ({ orderId, status }) => updateOrderStatus({ storeId, orderId, status }),
    onSuccess: (_result, variables) => {
      invalidateOrders()
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(storeId, variables.orderId) })
      toast.success('Status do pedido atualizado.')
    },
    onError: handleError,
  })

  return {
    createOrderMutation,
    updateOrderMutation,
    deleteOrderMutation,
    updateOrderStatusMutation,
  }
}
