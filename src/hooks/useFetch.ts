import { useCallback, useEffect, useState, type DependencyList } from 'react'

export interface IUseFetchOptions<T> extends RequestInit {
  enabled?: boolean
  immediate?: boolean
  initialData?: T | null
  dependencies?: DependencyList
  parser?: (response: Response) => Promise<T>
}

export interface IUseFetchResult<T> {
  data: T | null
  error: Error | null
  loading: boolean
  refetch: () => Promise<T | null>
}

/**
 * Hook genérico de fetch para cenários fora do React Query.
 */
export function useFetch<T>(
  url: string | null,
  options: IUseFetchOptions<T> = {},
): IUseFetchResult<T> {
  const {
    enabled = true,
    immediate = true,
    initialData = null,
    dependencies = [],
    parser,
    ...requestInit
  } = options

  const [data, setData] = useState<T | null>(initialData)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!url || !enabled) {
      return initialData
    }

    const controller = new AbortController()

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(url, {
        ...requestInit,
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Falha ao carregar ${url}: ${response.status}`)
      }

      const nextData = parser ? await parser(response) : ((await response.json()) as T)
      setData(nextData)
      return nextData
    } catch (caughtError) {
      const normalizedError =
        caughtError instanceof Error ? caughtError : new Error('Falha desconhecida na requisicao.')
      setError(normalizedError)
      throw normalizedError
    } finally {
      setLoading(false)
      controller.abort()
    }
  }, [enabled, initialData, parser, requestInit, url])

  useEffect(() => {
    if (!enabled || !immediate || !url) {
      return
    }

    void refetch().catch(() => null)
  }, [enabled, immediate, refetch, url, ...dependencies])

  return {
    data,
    error,
    loading,
    refetch,
  }
}
