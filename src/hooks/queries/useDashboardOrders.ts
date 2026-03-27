import { useMemo } from 'react'

import { useOrders } from './useOrders'
import type { IUseOrdersOptions } from './useOrders'

/**
 * Hook de resumo rapido para dashboard ou cabecalhos.
 */
export function useDashboardOrders(options: IUseOrdersOptions = {}) {
  const query = useOrders({
    pageSize: 5,
    ...options,
  })

  const summary = useMemo(
    () => ({
      count: query.data?.items?.length ?? 0,
      items: query.data?.items ?? [],
    }),
    [query.data],
  )

  return {
    ...query,
    summary,
  }
}
