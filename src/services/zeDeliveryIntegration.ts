import { requestBackend } from './backendApi'
import {
  getE2eZeDeliveryDashboard,
  isE2eMode,
  triggerE2eZeDeliverySync,
  updateE2eZeDeliverySettings,
} from './e2eRuntime'

export interface IZeDeliverySerializedError {
  name?: string | null
  message?: string | null
  stack?: string | null
  code?: string | null
  status?: number | null
}

export interface IZeDeliveryStoreSettings {
  enabled: boolean
  intervalMinutes: 5 | 10 | 15 | 30
  notificationsEnabled: boolean
  notificationWebhookUrl: string
}

export interface IZeDeliveryRunSummary {
  runId?: string
  processed?: number
  created?: number
  updated?: number
  unchanged?: number
  failed?: number
  dryRun?: boolean
  trigger?: string
  startedAt?: string
  completedAt?: string
  durationMs?: number
  success?: boolean
  error?: IZeDeliverySerializedError | null
}

export interface IZeDeliveryLogRecord extends Record<string, unknown> {
  id: string
  storeId: string
  source?: string
  trigger?: string
  createdAt?: string
  summary?: IZeDeliveryRunSummary
}

export interface IZeDeliveryStats24h {
  deliveriesSynced: number
  errors: number
  averageDurationMs: number
  failureRate: number
  totalRuns: number
}

export interface IZeDeliveryStoreDashboard {
  storeId: string
  status?: {
    lastSyncAt?: string | null
    lastSyncSuccess?: boolean | null
    lastSyncError?: string | null
    counters?: {
      created?: number
      updated?: number
      unchanged?: number
      failed?: number
    } | null
  } | null
  settings: IZeDeliveryStoreSettings
  recentOrders: Array<Record<string, unknown>>
  recentLogs: IZeDeliveryLogRecord[]
  stats24h: IZeDeliveryStats24h
}

export interface IZeDeliveryDashboard {
  summary: {
    status: string
    lastSync: string | null
    nextSync: string | null
    errorCount: number
    successRate: number | null
  }
  scheduler: {
    status: string
    lastSync: string | null
    nextSync: string | null
    errorCount: number
    successRate: number | null
    workers?: Array<Record<string, unknown>>
  }
  recentErrors: IZeDeliveryLogRecord[]
  recentRuns: IZeDeliveryLogRecord[]
  stats24h: IZeDeliveryStats24h
  stores: IZeDeliveryStoreDashboard[]
}

export interface ITriggerZeDeliverySyncPayload {
  storeId: string
  dryRun?: boolean
  maxOrders?: number
}

export interface IUpdateZeDeliverySettingsPayload extends IZeDeliveryStoreSettings {
  storeId: string
}

export async function getZeDeliveryDashboard({
  storeId,
}: {
  storeId?: string | null
}): Promise<IZeDeliveryDashboard> {
  if (isE2eMode()) {
    return getE2eZeDeliveryDashboard({ storeId })
  }

  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : ''
  return requestBackend(`/integrations/ze-delivery/dashboard${query}`)
}

export async function getZeDeliverySettings({
  storeId,
}: {
  storeId: string
}): Promise<IZeDeliveryStoreSettings> {
  return requestBackend(`/integrations/ze-delivery/settings?storeId=${encodeURIComponent(storeId)}`)
}

export async function updateZeDeliverySettings(
  payload: IUpdateZeDeliverySettingsPayload,
): Promise<IZeDeliveryStoreSettings> {
  if (isE2eMode()) {
    return (
      (await updateE2eZeDeliverySettings(payload)) ?? {
        enabled: payload.enabled,
        intervalMinutes: payload.intervalMinutes,
        notificationsEnabled: payload.notificationsEnabled,
        notificationWebhookUrl: payload.notificationWebhookUrl,
      }
    )
  }

  return requestBackend('/integrations/ze-delivery/settings', {
    method: 'PATCH',
    body: payload,
  })
}

export async function triggerZeDeliverySync(
  payload: ITriggerZeDeliverySyncPayload,
): Promise<Record<string, unknown>> {
  if (isE2eMode()) {
    return triggerE2eZeDeliverySync(payload)
  }

  return requestBackend('/integrations/ze-delivery/sync', {
    method: 'POST',
    body: payload,
  })
}

export function buildZeDeliveryLogsCsv(logs: IZeDeliveryLogRecord[]) {
  const rows = [
    ['timestamp', 'loja', 'status', 'entregas', 'duracao_ms', 'trigger', 'erro'].join(','),
    ...logs.map((log) =>
      [
        log.createdAt ?? '',
        log.storeId,
        log.summary?.success === false ? 'error' : 'success',
        String(log.summary?.processed ?? 0),
        String(log.summary?.durationMs ?? 0),
        log.summary?.trigger ?? log.trigger ?? '',
        JSON.stringify(log.summary?.error?.message ?? '')
          .split('"')
          .join('""'),
      ].join(','),
    ),
  ]

  return rows.join('\n')
}
