export { useAuth } from './useAuth'
export type {
  IAuthHookContext,
  ISignInCredentials,
  IUserClaims,
  IUserPermissions,
  IUserSession,
} from './useAuth'

export { useStore } from './useStore'
export type { IStoreHookContext } from './useStore'

export { ToastProvider, useToast } from './useToast'
export type { IToastApi, IToastOptions, IToastRecord, ToastVariant } from './useToast'

export { ConfirmProvider, useConfirm } from './useConfirm'
export type { ConfirmTone, IConfirmApi, IConfirmOptions } from './useConfirm'

export { useFetch } from './useFetch'
export type { IUseFetchOptions, IUseFetchResult } from './useFetch'
export { useError } from './useError'

export { useOrders, useOrder, useOrderMutations } from './queries/useOrders'
export type {
  IOrderListResult,
  IOrderMutationOptions,
  IOrderRecord,
  IQueryCursor,
  IUseOrdersOptions,
} from './queries/useOrders'

export { useSales, useSale, useSaleMutations } from './queries/useSales'
export type {
  ISaleListResult,
  ISaleMutationOptions,
  ISaleRecord,
  IUseSalesOptions,
} from './queries/useSales'

export { useFinancialEntries, useFinancialEntryMutations } from './queries/useFinancialEntries'
export type {
  IFinancialEntryListResult,
  IFinancialEntryRecord,
  IUseFinancialEntriesOptions,
} from './queries/useFinancialEntries'

export { useFinancialClosures, useFinancialClosureMutations } from './queries/useFinancialClosures'
export type {
  IFinancialClosureListResult,
  IFinancialClosureRecord,
  IUseFinancialClosuresOptions,
} from './queries/useFinancialClosures'

export { useDashboardOrders } from './queries/useDashboardOrders'
export { useDashboardSales } from './queries/useDashboardSales'
