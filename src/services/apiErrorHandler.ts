import * as Sentry from '@sentry/react'

import {
  AppError,
  ErrorCode,
  ErrorHandler,
  ErrorSeverity,
  NetworkError,
  TimeoutError,
} from './errorHandler'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface IApiErrorContext {
  feature?: string
  action?: string
  path?: string
  method?: HttpMethod
  requestId?: string
  [key: string]: unknown
}

export interface IApiErrorDisplayModel {
  code: string
  title: string
  message: string
  suggestion: string
  severity: ErrorSeverity
}

export interface IOfflineRequestQueueItem {
  id: string
  path: string
  method: HttpMethod
  body?: unknown
  headers?: Record<string, string>
  skipAuth?: boolean
  queuedAt: string
  retries: number
}

const OFFLINE_QUEUE_KEY = 'nexus10.offlineRequestQueue'
const VITE_SENTRY_DSN = import.meta.env['VITE_SENTRY_DSN'] as string | undefined
let sentryReady = false

function ensureSentryInitialized() {
  if (sentryReady || !VITE_SENTRY_DSN) {
    return
  }

  Sentry.init({
    dsn: VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE,
    tracesSampleRate: 0.1,
  })

  sentryReady = true
}

function readOfflineQueue(): IOfflineRequestQueueItem[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const rawValue = window.localStorage.getItem(OFFLINE_QUEUE_KEY)
    const parsedValue = JSON.parse(rawValue ?? '[]')
    return Array.isArray(parsedValue) ? parsedValue : []
  } catch {
    return []
  }
}

function writeOfflineQueue(items: IOfflineRequestQueueItem[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items))
}

function getDisplayCode(errorCode: ErrorCode): string {
  const codeMap: Record<ErrorCode, string> = {
    [ErrorCode.VALIDATION_ERROR]: 'ERR_001',
    [ErrorCode.UNAUTHORIZED]: 'ERR_002',
    [ErrorCode.FORBIDDEN]: 'ERR_003',
    [ErrorCode.NOT_FOUND]: 'ERR_004',
    [ErrorCode.CONFLICT]: 'ERR_005',
    [ErrorCode.INTERNAL_SERVER_ERROR]: 'ERR_006',
    [ErrorCode.SERVICE_UNAVAILABLE]: 'ERR_007',
    [ErrorCode.NETWORK_ERROR]: 'ERR_008',
    [ErrorCode.TIMEOUT_ERROR]: 'ERR_009',
    [ErrorCode.OFFLINE_ERROR]: 'ERR_010',
    [ErrorCode.SYNC_ERROR]: 'ERR_011',
    [ErrorCode.CACHE_ERROR]: 'ERR_012',
  }

  return codeMap[errorCode] ?? 'ERR_999'
}

function getDisplayTitle(errorCode: ErrorCode): string {
  switch (errorCode) {
    case ErrorCode.VALIDATION_ERROR:
      return 'Dados invalidos'
    case ErrorCode.UNAUTHORIZED:
      return 'Sessao expirada'
    case ErrorCode.FORBIDDEN:
      return 'Acesso negado'
    case ErrorCode.NOT_FOUND:
      return 'Recurso nao encontrado'
    case ErrorCode.CONFLICT:
      return 'Conflito de dados'
    case ErrorCode.NETWORK_ERROR:
    case ErrorCode.OFFLINE_ERROR:
      return 'Sem conexao'
    case ErrorCode.TIMEOUT_ERROR:
      return 'Tempo de resposta excedido'
    case ErrorCode.SERVICE_UNAVAILABLE:
      return 'Servico indisponivel'
    default:
      return 'Falha inesperada'
  }
}

function getDisplaySuggestion(errorCode: ErrorCode): string {
  switch (errorCode) {
    case ErrorCode.VALIDATION_ERROR:
      return 'Revise os campos destacados e tente novamente.'
    case ErrorCode.UNAUTHORIZED:
      return 'Entre novamente para renovar a sessao.'
    case ErrorCode.FORBIDDEN:
      return 'Solicite acesso ao gestor da operacao.'
    case ErrorCode.NETWORK_ERROR:
    case ErrorCode.OFFLINE_ERROR:
      return 'Verifique a conexao. Se estiver offline, a acao pode ser reenviada ao reconectar.'
    case ErrorCode.TIMEOUT_ERROR:
      return 'Tente novamente em alguns segundos.'
    case ErrorCode.SERVICE_UNAVAILABLE:
      return 'Aguarde alguns instantes antes de repetir a acao.'
    default:
      return 'Tente novamente. Se o erro persistir, acione o suporte.'
  }
}

export function toApiError(error: unknown, context: IApiErrorContext = {}): AppError {
  const normalized = ErrorHandler.normalize(error)
  return new AppError(
    normalized.message,
    normalized.code,
    normalized.status,
    normalized.severity,
    normalized.details,
    {
      ...normalized.context,
      ...context,
    },
  )
}

export function getApiErrorDisplayModel(error: unknown): IApiErrorDisplayModel {
  const normalized = ErrorHandler.normalize(error)

  return {
    code: getDisplayCode(normalized.code),
    title: getDisplayTitle(normalized.code),
    message: ErrorHandler.getUserMessage(normalized),
    suggestion: getDisplaySuggestion(normalized.code),
    severity: normalized.severity,
  }
}

export function captureErrorForMonitoring(error: unknown, context: IApiErrorContext = {}) {
  const normalized = toApiError(error, context)
  ensureSentryInitialized()

  if (sentryReady) {
    Sentry.withScope((scope) => {
      scope.setLevel(
        normalized.severity === ErrorSeverity.CRITICAL || normalized.severity === ErrorSeverity.HIGH
          ? 'error'
          : normalized.severity === ErrorSeverity.MEDIUM
            ? 'warning'
            : 'info',
      )
      scope.setContext('api', normalized.toJSON())
      scope.setExtras(context)
      Sentry.captureException(normalized)
    })
  } else {
    normalized.log()
  }

  return normalized
}

export function isRetriableApiError(error: unknown) {
  const normalized = ErrorHandler.normalize(error)

  return (
    normalized.code === ErrorCode.NETWORK_ERROR ||
    normalized.code === ErrorCode.TIMEOUT_ERROR ||
    normalized.code === ErrorCode.OFFLINE_ERROR ||
    normalized.code === ErrorCode.SERVICE_UNAVAILABLE ||
    normalized.status >= 500
  )
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  {
    retries = 2,
    baseDelay = 600,
  }: {
    retries?: number
    baseDelay?: number
  } = {},
) {
  let attempt = 0

  while (attempt <= retries) {
    try {
      return await operation()
    } catch (error) {
      const normalized = ErrorHandler.normalize(error)

      if (attempt === retries || !isRetriableApiError(normalized)) {
        throw normalized
      }

      const delay = baseDelay * 2 ** attempt
      await new Promise((resolve) => window.setTimeout(resolve, delay))
      attempt += 1
    }
  }

  throw new AppError('Falha inesperada ao repetir a requisicao.')
}

export function createOfflineQueuedError(context: IApiErrorContext = {}) {
  return new AppError(
    'Acao registrada para envio quando a conexao voltar.',
    ErrorCode.OFFLINE_ERROR,
    0,
    ErrorSeverity.MEDIUM,
    null,
    context,
  )
}

export function enqueueOfflineRequest(
  item: Omit<IOfflineRequestQueueItem, 'id' | 'queuedAt' | 'retries'>,
) {
  const queue = readOfflineQueue()
  const nextItem: IOfflineRequestQueueItem = {
    ...item,
    id: `offline-request-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
    retries: 0,
  }

  writeOfflineQueue([...queue, nextItem])
  return nextItem
}

export function getOfflineQueueCount() {
  return readOfflineQueue().length
}

export async function flushOfflineRequestQueue(
  dispatcher: (item: IOfflineRequestQueueItem) => Promise<unknown>,
) {
  const queue = readOfflineQueue()

  if (!queue.length || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return {
      flushedCount: 0,
      pendingCount: queue.length,
    }
  }

  const pendingItems: IOfflineRequestQueueItem[] = []
  let flushedCount = 0

  for (const item of queue) {
    try {
      await dispatcher(item)
      flushedCount += 1
    } catch (error) {
      pendingItems.push({
        ...item,
        retries: item.retries + 1,
      })
      captureErrorForMonitoring(error, {
        feature: 'offline-queue',
        action: 'flush',
        path: item.path,
        method: item.method,
      })
    }
  }

  writeOfflineQueue(pendingItems)

  return {
    flushedCount,
    pendingCount: pendingItems.length,
  }
}

export function buildBackendResponseError(
  payload: Record<string, unknown> | null,
  status: number,
  context: IApiErrorContext = {},
) {
  const code = String(payload?.code ?? '')
  const message =
    String(payload?.error ?? payload?.message ?? '').trim() ||
    (status >= 500 ? 'Falha interna no servidor.' : 'Nao foi possivel concluir a requisicao.')

  if (status === 400 || code === 'VALIDATION_ERROR') {
    return new AppError(
      message,
      ErrorCode.VALIDATION_ERROR,
      status || 400,
      ErrorSeverity.LOW,
      payload?.details ?? payload,
      context,
    )
  }

  if (status === 401) {
    return new AppError(
      message,
      ErrorCode.UNAUTHORIZED,
      status,
      ErrorSeverity.MEDIUM,
      payload,
      context,
    )
  }

  if (status === 403) {
    return new AppError(
      message,
      ErrorCode.FORBIDDEN,
      status,
      ErrorSeverity.MEDIUM,
      payload,
      context,
    )
  }

  if (status === 404) {
    return new AppError(
      message,
      ErrorCode.NOT_FOUND,
      status,
      ErrorSeverity.MEDIUM,
      payload,
      context,
    )
  }

  if (status === 409) {
    return new AppError(message, ErrorCode.CONFLICT, status, ErrorSeverity.MEDIUM, payload, context)
  }

  if (status === 503) {
    return new AppError(
      message,
      ErrorCode.SERVICE_UNAVAILABLE,
      status,
      ErrorSeverity.HIGH,
      payload,
      context,
    )
  }

  return new AppError(
    message,
    status >= 500 ? ErrorCode.INTERNAL_SERVER_ERROR : ErrorCode.NETWORK_ERROR,
    status || 500,
    status >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
    payload,
    context,
  )
}

export function buildOfflineNetworkError(context: IApiErrorContext = {}) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return new AppError(
      'Voce esta offline no momento.',
      ErrorCode.OFFLINE_ERROR,
      0,
      ErrorSeverity.MEDIUM,
      null,
      context,
    )
  }

  return new NetworkError('Nao foi possivel conectar ao servidor.', context)
}

export function buildTimeoutError(context: IApiErrorContext = {}) {
  return new TimeoutError('A requisicao demorou mais do que o esperado.', context)
}
