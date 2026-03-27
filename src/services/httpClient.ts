import {
  AppError,
  ErrorCode,
  ErrorHandler,
  ErrorSeverity,
  NetworkError,
  TimeoutError,
} from '@services/errorHandler'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface IHttpClientConfig {
  baseURL?: string
  timeout?: number
  retries?: number
  retryDelay?: number
  retryableStatuses?: number[]
}

export interface IRequestConfig extends Omit<RequestInit, 'method' | 'body'> {
  query?: Record<string, string | number | boolean | undefined | null>
  body?: BodyInit | Record<string, unknown> | null
  timeout?: number
  retries?: number
}

const DEFAULT_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787/api'

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function buildUrl(baseURL: string, path: string, query?: IRequestConfig['query']) {
  const normalizedBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${normalizedBase}${normalizedPath}`)

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    url.searchParams.set(key, String(value))
  })

  return url.toString()
}

function isJsonBody(body: unknown): body is Record<string, unknown> {
  return (
    Boolean(body) &&
    typeof body === 'object' &&
    !(body instanceof FormData) &&
    !(body instanceof Blob)
  )
}

function resolveErrorCode(status: number): ErrorCode {
  if (status === 401) {
    return ErrorCode.UNAUTHORIZED
  }

  if (status === 403) {
    return ErrorCode.FORBIDDEN
  }

  if (status === 404) {
    return ErrorCode.NOT_FOUND
  }

  if (status === 409) {
    return ErrorCode.CONFLICT
  }

  if (status === 503) {
    return ErrorCode.SERVICE_UNAVAILABLE
  }

  return ErrorCode.INTERNAL_SERVER_ERROR
}

function resolveSeverity(status: number): ErrorSeverity {
  if (status >= 500) {
    return ErrorSeverity.HIGH
  }

  if (status >= 400) {
    return ErrorSeverity.MEDIUM
  }

  return ErrorSeverity.LOW
}

export class HttpClient {
  private readonly config: Required<IHttpClientConfig>

  constructor(config: IHttpClientConfig = {}) {
    this.config = {
      baseURL: config.baseURL ?? DEFAULT_BASE_URL,
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      retryableStatuses: config.retryableStatuses ?? [408, 429, 500, 502, 503, 504],
    }
  }

  async request<T>(method: HttpMethod, url: string, config: IRequestConfig = {}): Promise<T> {
    const retries = config.retries ?? this.config.retries
    let lastError: AppError | null = null

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await this.executeRequest<T>(method, url, config)
      } catch (error) {
        const normalized = ErrorHandler.normalize(error)
        lastError = normalized

        const shouldRetryByStatus =
          normalized.status > 0 && this.config.retryableStatuses.includes(normalized.status)
        const shouldRetry =
          attempt < retries && (ErrorHandler.isRecoverable(normalized) || shouldRetryByStatus)

        if (!shouldRetry) {
          throw normalized
        }

        const delay = this.config.retryDelay * 2 ** attempt
        await sleep(delay)
      }
    }

    throw lastError ?? new AppError('Falha ao processar a requisicao.')
  }

  private async executeRequest<T>(
    method: HttpMethod,
    url: string,
    config: IRequestConfig,
  ): Promise<T> {
    const controller = new AbortController()
    const timeout = config.timeout ?? this.config.timeout
    const timeoutId = window.setTimeout(() => controller.abort(), timeout)

    try {
      const headers = new Headers(config.headers ?? {})
      let body: BodyInit | undefined

      if (isJsonBody(config.body)) {
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json')
        }
        body = JSON.stringify(config.body)
      } else if (config.body != null) {
        body = config.body as BodyInit
      }

      const response = await fetch(buildUrl(this.config.baseURL, url, config.query), {
        ...config,
        method,
        headers,
        body,
        signal: controller.signal,
      })

      const contentType = response.headers.get('content-type') ?? ''
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : await response.text().catch(() => null)

      if (!response.ok) {
        const message =
          (payload as { message?: string } | null)?.message ||
          response.statusText ||
          'Falha na requisicao.'

        throw new AppError(
          message,
          resolveErrorCode(response.status),
          response.status,
          resolveSeverity(response.status),
          payload,
          { path: url, method },
        )
      }

      return payload as T
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new TimeoutError('A requisicao excedeu o tempo limite.', {
          path: url,
          method,
          timeout,
        })
      }

      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        throw new NetworkError('Nao foi possivel conectar ao servidor.', { path: url, method })
      }

      throw ErrorHandler.normalize(error)
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  get<T>(url: string, config?: IRequestConfig) {
    return this.request<T>('GET', url, config)
  }

  post<T>(url: string, body?: IRequestConfig['body'], config: IRequestConfig = {}) {
    return this.request<T>('POST', url, { ...config, body })
  }

  put<T>(url: string, body?: IRequestConfig['body'], config: IRequestConfig = {}) {
    return this.request<T>('PUT', url, { ...config, body })
  }

  patch<T>(url: string, body?: IRequestConfig['body'], config: IRequestConfig = {}) {
    return this.request<T>('PATCH', url, { ...config, body })
  }

  delete<T>(url: string, config?: IRequestConfig) {
    return this.request<T>('DELETE', url, config)
  }
}

export const httpClient = new HttpClient()
