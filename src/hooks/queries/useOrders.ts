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

export interface IQueryCursor {
  id: string
  value?: unknown
  orderField?: string
}

export interface IOrderRecord extends Record<string, unknown> {
  id: string
  status?: string
  domainStatus?: string
  customerName?: string
  totalAmount?: number
}

export interface IOrderListResult<TOrder = IOrderRecord> {
  items: TOrder[]
  nextCursor: IQueryCursor | null
  hasMore: boolean
}

export interface IUseOrdersOptions {
  storeId?: string | null
  pageSize?: number
  cursor?: IQueryCursor | null
  enabled?: boolean
}

export interface IOrderMutationOptions {
  storeId?: string | null
  tenantId?: string | null
  createdBy?: string | null
}

const listOrdersPageTyped = listOrdersPage as (args: {
  storeId?: string | null
  pageSize?: number
  cursor?: IQueryCursor | null
}) => Promise<IOrderListResult>

const getOrderByIdTyped = getOrderById as (args: {
  storeId?: string | null
  orderId?: string | null
}) => Promise<IOrderRecord | null>

const createOrderTyped = createOrder as (args: {
  storeId?: string | null
  tenantId?: string | null
  values: Record<string, unknown>
  createdBy?: string | null
}) => Promise<string>

const updateOrderTyped = updateOrder as (args: {
  storeId?: string | null
  orderId: string
  values: Record<string, unknown>
}) => Promise<string>

const deleteOrderTyped = deleteOrder as (args: {
  storeId?: string | null
  orderId: string
}) => Promise<string>

const updateOrderStatusTyped = updateOrderStatus as (args: {
  storeId?: string | null
  orderId: string
  status: string
}) => Promise<void>

/**
 * Query paginada de pedidos.
 */
export function useOrders({
  storeId,
  pageSize = 50,
  cursor = null,
  enabled = true,
}: IUseOrdersOptions = {}) {
  const queryResult = useQuery<IOrderListResult>({
    queryKey: queryKeys.orders.list(storeId, { pageSize, cursorId: cursor?.id ?? null }),
    enabled: Boolean(storeId) && enabled,
    queryFn: () => listOrdersPageTyped({ storeId, pageSize, cursor }),
  })

  useQueryErrorFeedback(queryResult.error)
  return queryResult
}

/**
 * Query de detalhe de pedido.
 */
export function useOrder({
  storeId,
  orderId,
  enabled = true,
}: IUseOrdersOptions & { orderId?: string | null } = {}) {
  const queryResult = useQuery<IOrderRecord | null>({
    queryKey: queryKeys.orders.detail(storeId, orderId),
    enabled: Boolean(storeId && orderId) && enabled,
    queryFn: () => getOrderByIdTyped({ storeId, orderId }),
  })

  useQueryErrorFeedback(queryResult.error)
  return queryResult
}

/**
 * Mutations de pedidos com invalidação centralizada.
 */
export function useOrderMutations({
  storeId,
  tenantId,
  createdBy = null,
}: IOrderMutationOptions = {}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { handleError } = useErrorHandler()

  const invalidateOrders = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.all(storeId) })
  }

  const createOrderMutation = useMutation({
    mutationKey: ['orders', 'create', storeId],
    mutationFn: (values: Record<string, unknown>) =>
      createOrderTyped({ storeId, tenantId, values, createdBy }),
    onSuccess: () => {
      invalidateOrders()
      toast.success('Pedido criado.')
    },
    onError: handleError,
  })

  const updateOrderMutation = useMutation({
    mutationKey: ['orders', 'update', storeId],
    mutationFn: ({ orderId, values }: { orderId: string; values: Record<string, unknown> }) =>
      updateOrderTyped({ storeId, orderId, values }),
    onSuccess: (_result, variables) => {
      invalidateOrders()
      queryClient.invalidateQueries({
        queryKey: queryKeys.orders.detail(storeId, variables.orderId),
      })
      toast.success('Pedido atualizado.')
    },
    onError: handleError,
  })

  const deleteOrderMutation = useMutation({
    mutationKey: ['orders', 'delete', storeId],
    mutationFn: (orderId: string) => deleteOrderTyped({ storeId, orderId }),
    onSuccess: (_result, orderId) => {
      invalidateOrders()
      queryClient.removeQueries({ queryKey: queryKeys.orders.detail(storeId, orderId) })
      toast.success('Pedido excluido.')
    },
    onError: handleError,
  })

  const updateOrderStatusMutation = useMutation({
    mutationKey: ['orders', 'status', storeId],
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      updateOrderStatusTyped({ storeId, orderId, status }),
    onSuccess: (_result, variables) => {
      invalidateOrders()
      queryClient.invalidateQueries({
        queryKey: queryKeys.orders.detail(storeId, variables.orderId),
      })
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
