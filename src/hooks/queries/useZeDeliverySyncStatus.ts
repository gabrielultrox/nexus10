import { useQuery } from '@tanstack/react-query'

import {
  getZeDeliveryDashboard,
  type IZeDeliveryDashboard,
} from '../../services/zeDeliveryIntegration'
import { queryKeys } from './queryKeys'
import { useQueryErrorFeedback } from './useQueryErrorFeedback'

export interface IUseZeDeliverySyncStatusOptions {
  storeId?: string | null
  enabled?: boolean
}

/**
 * Estado do dashboard de sincronizacao do Ze Delivery com auto-refresh.
 */
export function useZeDeliverySyncStatus({
  storeId,
  enabled = true,
}: IUseZeDeliverySyncStatusOptions = {}) {
  const queryResult = useQuery<IZeDeliveryDashboard>({
    queryKey: queryKeys.zeDelivery.dashboard(storeId ?? 'all'),
    enabled: Boolean(storeId) && enabled,
    queryFn: () => getZeDeliveryDashboard({ storeId }),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  useQueryErrorFeedback(queryResult.error)
  return queryResult
}
