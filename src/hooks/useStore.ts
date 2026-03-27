import { useStore as useStoreContext } from '../contexts/StoreContext'

export interface IStoreHookContext {
  currentStoreId: string | null
  availableStoreIds: string[]
  loading: boolean
  tenantId: string | null
  setCurrentStoreId: (storeId: string | null | ((current: string | null) => string | null)) => void
}

/**
 * Wrapper tipado para o StoreContext legado.
 */
export function useStore(): IStoreHookContext {
  return useStoreContext() as IStoreHookContext
}
