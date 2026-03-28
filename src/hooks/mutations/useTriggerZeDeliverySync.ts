import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useToast } from '../useToast'
import { useErrorHandler } from '../useErrorHandler'
import {
  triggerZeDeliverySync,
  updateZeDeliverySettings,
  type ITriggerZeDeliverySyncPayload,
  type IUpdateZeDeliverySettingsPayload,
} from '../../services/zeDeliveryIntegration'
import { queryKeys } from '../queries/queryKeys'

export interface IUseZeDeliveryMutationOptions {
  storeId?: string | null
}

/**
 * Mutations do painel Ze Delivery: sync manual, retry e atualizacao de configuracao.
 */
export function useTriggerZeDeliverySync({ storeId }: IUseZeDeliveryMutationOptions = {}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { handleError } = useErrorHandler()

  const invalidateZeDelivery = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.zeDelivery.all(storeId ?? 'all') })
  }

  const triggerSyncMutation = useMutation({
    mutationKey: ['ze-delivery', 'sync', storeId],
    mutationFn: (payload: ITriggerZeDeliverySyncPayload) => triggerZeDeliverySync(payload),
    onSuccess: () => {
      invalidateZeDelivery()
      toast.success('Sincronizacao Ze Delivery iniciada.')
    },
    onError: handleError,
  })

  const retrySyncMutation = useMutation({
    mutationKey: ['ze-delivery', 'retry', storeId],
    mutationFn: (payload: ITriggerZeDeliverySyncPayload) => triggerZeDeliverySync(payload),
    onSuccess: () => {
      invalidateZeDelivery()
      toast.success('Nova tentativa disparada.')
    },
    onError: handleError,
  })

  const updateSettingsMutation = useMutation({
    mutationKey: ['ze-delivery', 'settings', storeId],
    mutationFn: (payload: IUpdateZeDeliverySettingsPayload) => updateZeDeliverySettings(payload),
    onSuccess: () => {
      invalidateZeDelivery()
      toast.success('Configuracoes do Ze Delivery atualizadas.')
    },
    onError: handleError,
  })

  return {
    triggerSyncMutation,
    retrySyncMutation,
    updateSettingsMutation,
  }
}
