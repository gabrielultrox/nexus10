import { useMemo } from 'react'

import { useSales } from './useSales'
import type { IUseSalesOptions } from './useSales'

/**
 * Hook de resumo rapido de vendas para shells e dashboards.
 */
export function useDashboardSales(options: IUseSalesOptions = {}) {
  const query = useSales({
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
