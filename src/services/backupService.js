import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'

import { MANUAL_COURIER_STORAGE_KEY } from './courierService'
import { canUseRemoteSync, firebaseDb, firebaseReady } from './firebase'
import { FIRESTORE_COLLECTIONS } from './firestoreCollections'
import { loadLocalRecords, loadResettableLocalRecords } from './localAccess'
import { loadAuditEvents } from './localAudit'
import { manualModuleConfigs } from './manualModuleConfig'

const BACKUP_STATUS_SETTING_ID = 'backup_status'
const BACKUP_SYNC_EVENT = 'nexus10:backup-sync'
const BACKUP_BATCH_INTERVAL_MS = 5 * 60 * 1000
const BACKUP_IMMEDIATE_DEBOUNCE_MS = 500
const OFFLINE_QUEUE_KEY = 'nexus10.offlineRequestQueue'
const CASH_STATE_STORAGE_KEY = 'nexus-module-cash-state'
const CASH_STORAGE_KEY = 'nexus-module-cash'
const CASH_RESET_HOUR = 3
const FINANCIAL_PENDING_STORAGE_KEY = 'nexus-module-cash-financial-pending'
function createSessionId() {
  return `backup-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function createRunId() {
  return `backup-run-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function getStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}

function emitBackupState(state) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return
  }

  window.dispatchEvent(
    new CustomEvent(BACKUP_SYNC_EVENT, {
      detail: state,
    }),
  )
}

function createHash(value) {
  const input = typeof value === 'string' ? value : JSON.stringify(value)
  let hash = 2166136261

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return Math.abs(hash >>> 0).toString(16)
}

function parseTimestamp(value) {
  if (!value) {
    return 0
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate().getTime()
  }

  if (typeof value?.seconds === 'number') {
    return value.seconds * 1000
  }

  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function resolveLatestRecordTimestamp(records) {
  return records.reduce((latest, record) => {
    const recordTimestamp = Math.max(
      parseTimestamp(record?.updatedAtClient),
      parseTimestamp(record?.createdAtClient),
      parseTimestamp(record?.updatedAt),
      parseTimestamp(record?.createdAt),
      parseTimestamp(record?.timestamp),
      parseTimestamp(record?.date),
    )

    return Math.max(latest, recordTimestamp)
  }, 0)
}

function serializeError(error) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error ?? 'Falha desconhecida no backup.')
}

function toIsoOrNow(value) {
  const parsed = parseTimestamp(value)
  return parsed > 0 ? new Date(parsed).toISOString() : new Date().toISOString()
}

function getOperationalDay(resetHour = 3) {
  const now = new Date()
  const operationalDate = new Date(now)

  if (now.getHours() < resetHour) {
    operationalDate.setDate(operationalDate.getDate() - 1)
  }

  const year = operationalDate.getFullYear()
  const month = String(operationalDate.getMonth() + 1).padStart(2, '0')
  const day = String(operationalDate.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function buildScopeDefinitions() {
  const manualScopes = Object.entries(manualModuleConfigs).map(([modulePath, config]) => ({
    id: `manual:${modulePath}`,
    storageKey: config.storageKey,
    category:
      modulePath === 'map'
        ? 'logs'
        : ['change', 'advances', 'discounts', 'occurrences', 'delivery-reading'].includes(modulePath)
          ? 'critical'
          : 'master',
    resetHour: config.dailyResetHour ?? null,
    readRecords() {
      if (config.dailyResetHour != null) {
        return loadResettableLocalRecords(config.storageKey, config.initialRecords ?? [], config.dailyResetHour)
      }

      return loadLocalRecords(config.storageKey, config.initialRecords ?? [])
    },
    metadata: {
      modulePath,
      label: config.formTitle,
    },
  }))

  return [
    {
      id: 'cash:records',
      storageKey: CASH_STORAGE_KEY,
      category: 'critical',
      resetHour: CASH_RESET_HOUR,
      readRecords() {
        return loadResettableLocalRecords(CASH_STORAGE_KEY, [], CASH_RESET_HOUR)
      },
      metadata: {
        label: 'Movimentacao de caixa',
      },
    },
    {
      id: 'cash:state',
      storageKey: CASH_STATE_STORAGE_KEY,
      category: 'critical',
      resetHour: CASH_RESET_HOUR,
      readRecords() {
        return loadLocalRecords(CASH_STATE_STORAGE_KEY, [])
      },
      metadata: {
        label: 'Estado do caixa',
      },
    },
    {
      id: 'cash:financial-pendings',
      storageKey: FINANCIAL_PENDING_STORAGE_KEY,
      category: 'critical',
      resetHour: null,
      readRecords() {
        return loadLocalRecords(FINANCIAL_PENDING_STORAGE_KEY, [])
      },
      metadata: {
        label: 'Pendencias financeiras',
      },
    },
    {
      id: 'operations:couriers',
      storageKey: MANUAL_COURIER_STORAGE_KEY,
      category: 'master',
      resetHour: null,
      readRecords() {
        return loadLocalRecords(MANUAL_COURIER_STORAGE_KEY, [])
      },
      metadata: {
        label: 'Entregadores locais',
      },
    },
    {
      id: 'audit:history',
      storageKey: 'nexus-local-audit-log',
      category: 'logs',
      resetHour: null,
      readRecords() {
        return loadAuditEvents()
      },
      metadata: {
        label: 'Historico operacional',
      },
    },
    {
      id: 'offline:queue',
      storageKey: OFFLINE_QUEUE_KEY,
      category: 'critical',
      resetHour: null,
      readRecords() {
        return loadLocalRecords(OFFLINE_QUEUE_KEY, [])
      },
      metadata: {
        label: 'Fila offline',
      },
    },
    ...manualScopes,
  ]
}

const scopeDefinitions = buildScopeDefinitions()
const scopeDefinitionsById = new Map(scopeDefinitions.map((scope) => [scope.id, scope]))
const scopeIdsByStorageKey = new Map()

scopeDefinitions.forEach((scope) => {
  const scopedIds = scopeIdsByStorageKey.get(scope.storageKey) ?? []
  scopedIds.push(scope.id)
  scopeIdsByStorageKey.set(scope.storageKey, scopedIds)
})

const serviceState = {
  sessionId: createSessionId(),
  status: 'idle',
  storeId: null,
  tenantId: null,
  userId: null,
  operatorName: '',
  lastAttemptedBackupAt: null,
  lastSuccessfulBackupAt: null,
  lastError: '',
  pendingScopes: [],
  nextBatchAt: null,
  lastDurationMs: 0,
  conflictCount: 0,
  statistics: {
    successfulRuns: 0,
    failedRuns: 0,
    scopesSynced: 0,
    recordsSynced: 0,
  },
}

let activeContext = null
let immediateTimerId = null
let batchTimerId = null
let inFlightPromise = null
const stateListeners = new Set()
const dirtyScopeIds = new Set()

function persistState() {
  const storage = getStorage()

  if (!storage || !serviceState.storeId) {
    return
  }

  try {
    storage.setItem(
      `nexus10.backup.state:${serviceState.storeId}`,
      JSON.stringify({
        ...serviceState,
        pendingScopes: [...dirtyScopeIds],
      }),
    )
  } catch {
    // Ignore local state cache failures for backup telemetry.
  }
}

function updateState(partialState) {
  Object.assign(serviceState, partialState)
  serviceState.pendingScopes = [...dirtyScopeIds]
  persistState()
  const snapshot = getBackupSyncState()
  stateListeners.forEach((listener) => listener(snapshot))
  emitBackupState(snapshot)
}

function scheduleNextBatch() {
  if (batchTimerId) {
    window.clearTimeout(batchTimerId)
  }

  const nextBatchAt = new Date(Date.now() + BACKUP_BATCH_INTERVAL_MS).toISOString()
  updateState({ nextBatchAt })

  if (typeof window === 'undefined') {
    return
  }

  batchTimerId = window.setTimeout(() => {
    flushBackupNow({ reason: 'batch-window', categories: ['logs'] }).catch(() => {})
  }, BACKUP_BATCH_INTERVAL_MS)
}

function resolveScopeIdsForStorageKey(storageKey) {
  return scopeIdsByStorageKey.get(storageKey) ?? []
}

function buildSnapshotPayload(scope) {
  const sourceRecords = scope.readRecords()
  const records = Array.isArray(sourceRecords) ? sourceRecords : []
  const latestTimestamp = resolveLatestRecordTimestamp(records)
  const updatedAtClient = latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : new Date().toISOString()
  const recordIds = records
    .map((record) => String(record?.id ?? record?.code ?? record?.deliveryCode ?? ''))
    .filter(Boolean)
    .slice(0, 1000)
  const operationalDay = scope.resetHour != null ? getOperationalDay(scope.resetHour) : null

  return {
    scopeId: scope.id,
    storageKey: scope.storageKey,
    category: scope.category,
    records,
    data: {
      scopeId: scope.id,
      storageKey: scope.storageKey,
      category: scope.category,
      storeId: activeContext.storeId,
      tenantId: activeContext.tenantId ?? null,
      updatedByUserId: activeContext.userId ?? null,
      updatedByOperator: activeContext.operatorName ?? '',
      clientSessionId: serviceState.sessionId,
      updatedAtClient,
      updatedAtServer: serverTimestamp(),
      operationalDay,
      recordsCount: records.length,
      recordIds,
      checksum: createHash(records),
      metadata: scope.metadata ?? {},
      records,
    },
  }
}

function resolveBackupConflict(localPayload, remotePayload) {
  if (!remotePayload) {
    return {
      winner: 'local',
      conflict: false,
      resolvedAt: localPayload.updatedAtClient,
    }
  }

  const localTimestamp = parseTimestamp(localPayload.updatedAtClient)
  const remoteTimestamp = parseTimestamp(remotePayload.updatedAtClient)
  const checksumChanged =
    String(remotePayload.checksum ?? '') !== String(localPayload.checksum ?? '')

  if (remoteTimestamp > localTimestamp) {
    return {
      winner: 'remote',
      conflict: checksumChanged,
      resolvedAt: toIsoOrNow(remotePayload.updatedAtClient),
    }
  }

  return {
    winner: 'local',
    conflict: checksumChanged && remoteTimestamp > 0,
    resolvedAt: localPayload.updatedAtClient,
  }
}

async function writeBackupRun({ reason, selectedScopeIds, mode }) {
  if (!activeContext?.storeId || !firebaseReady || !firebaseDb || !canUseRemoteSync()) {
    return {
      syncedScopes: 0,
      recordsSynced: 0,
      conflicts: 0,
      skippedScopes: selectedScopeIds,
    }
  }

  const startedAt = performance.now()
  const batch = writeBatch(firebaseDb)
  const runId = createRunId()
  const syncedScopes = []
  const skippedScopes = []
  const conflicts = []
  let recordsSynced = 0

  for (const scopeId of selectedScopeIds) {
    const scope = scopeDefinitionsById.get(scopeId)

    if (!scope) {
      continue
    }

    const payload = buildSnapshotPayload(scope)
    const snapshotRef = doc(
      firebaseDb,
      FIRESTORE_COLLECTIONS.stores,
      activeContext.storeId,
      FIRESTORE_COLLECTIONS.backupSnapshots,
      scopeId,
    )
    const remoteSnapshot = await getDoc(snapshotRef).catch(() => null)
    const resolution = resolveBackupConflict(payload.data, remoteSnapshot?.data())

    if (resolution.winner === 'remote') {
      skippedScopes.push(scopeId)

      if (resolution.conflict) {
        conflicts.push({
          scopeId,
          strategy: 'last-write-wins',
          resolvedAt: resolution.resolvedAt,
          winner: 'remote',
        })
      }

      continue
    }

    if (resolution.conflict) {
      conflicts.push({
        scopeId,
        strategy: 'last-write-wins',
        resolvedAt: resolution.resolvedAt,
        winner: 'local',
      })
    }

    batch.set(snapshotRef, payload.data, { merge: true })
    syncedScopes.push({
      scopeId,
      recordsCount: payload.records.length,
      category: scope.category,
      storageKey: scope.storageKey,
      updatedAtClient: payload.data.updatedAtClient,
    })
    recordsSynced += payload.records.length
  }

  const completedAtClient = new Date().toISOString()
  const durationMs = Math.round(performance.now() - startedAt)
  const statusRef = doc(
    firebaseDb,
    FIRESTORE_COLLECTIONS.stores,
    activeContext.storeId,
    FIRESTORE_COLLECTIONS.settings,
    BACKUP_STATUS_SETTING_ID,
  )
  const logRef = doc(
    collection(
      firebaseDb,
      FIRESTORE_COLLECTIONS.stores,
      activeContext.storeId,
      FIRESTORE_COLLECTIONS.backupLogs,
    ),
    runId,
  )

  batch.set(
    statusRef,
    {
      type: 'backup_status',
      storeId: activeContext.storeId,
      tenantId: activeContext.tenantId ?? null,
      updatedByUserId: activeContext.userId ?? null,
      updatedByOperator: activeContext.operatorName ?? '',
      clientSessionId: serviceState.sessionId,
      lastAttemptedBackupAt: completedAtClient,
      lastSuccessfulBackupAt: completedAtClient,
      lastError: '',
      lastMode: mode,
      lastReason: reason,
      lastDurationMs: durationMs,
      pendingScopes: skippedScopes,
      conflictCount: conflicts.length,
      syncedScopes,
      statistics: {
        totalRuns: Number(serviceState.statistics.successfulRuns ?? 0) + Number(serviceState.statistics.failedRuns ?? 0) + 1,
        successfulRuns: Number(serviceState.statistics.successfulRuns ?? 0) + 1,
        failedRuns: Number(serviceState.statistics.failedRuns ?? 0),
        scopesSynced: Number(serviceState.statistics.scopesSynced ?? 0) + syncedScopes.length,
        recordsSynced: Number(serviceState.statistics.recordsSynced ?? 0) + recordsSynced,
      },
      updatedAtClient: completedAtClient,
      updatedAtServer: serverTimestamp(),
    },
    { merge: true },
  )

  batch.set(
    logRef,
    {
      id: runId,
      storeId: activeContext.storeId,
      tenantId: activeContext.tenantId ?? null,
      updatedByUserId: activeContext.userId ?? null,
      updatedByOperator: activeContext.operatorName ?? '',
      clientSessionId: serviceState.sessionId,
      status: 'success',
      mode,
      reason,
      syncedScopes,
      skippedScopes,
      conflicts,
      recordsSynced,
      durationMs,
      startedAtClient: new Date(Date.now() - durationMs).toISOString(),
      completedAtClient,
      createdAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp(),
    },
    { merge: true },
  )

  await batch.commit()

  return {
    durationMs,
    syncedScopes: syncedScopes.length,
    recordsSynced,
    conflicts: conflicts.length,
    skippedScopes,
    completedAtClient,
  }
}

export function getBackupSyncState() {
  return {
    ...serviceState,
    pendingScopes: [...dirtyScopeIds],
  }
}

export function subscribeToBackupSyncState(listener) {
  stateListeners.add(listener)
  listener(getBackupSyncState())

  return () => {
    stateListeners.delete(listener)
  }
}

export function initializeBackupService(context) {
  activeContext = context?.storeId
    ? {
        storeId: context.storeId,
        tenantId: context.tenantId ?? null,
        userId: context.userId ?? null,
        operatorName: context.operatorName ?? '',
      }
    : null

  if (!activeContext) {
    dirtyScopeIds.clear()
    updateState({
      storeId: null,
      tenantId: null,
      userId: null,
      operatorName: '',
      status: 'idle',
      nextBatchAt: null,
    })
    return getBackupSyncState()
  }

  updateState({
    storeId: activeContext.storeId,
    tenantId: activeContext.tenantId,
    userId: activeContext.userId,
    operatorName: activeContext.operatorName,
  })
  scheduleNextBatch()
  return getBackupSyncState()
}

export function scheduleBackupForStorageKey(storageKey, options = {}) {
  const scopeIds = resolveScopeIdsForStorageKey(storageKey)

  if (!scopeIds.length) {
    return getBackupSyncState()
  }

  const immediate = options.immediate ?? scopeIds.some((scopeId) => {
    const scope = scopeDefinitionsById.get(scopeId)
    return scope?.category === 'critical'
  })

  scopeIds.forEach((scopeId) => dirtyScopeIds.add(scopeId))
  updateState({
    status: serviceState.status === 'syncing' ? 'syncing' : 'pending',
  })

  if (immediate && typeof window !== 'undefined') {
    if (immediateTimerId) {
      window.clearTimeout(immediateTimerId)
    }

    immediateTimerId = window.setTimeout(() => {
      flushBackupNow({
        reason: options.reason ?? 'critical-change',
        scopeIds,
      }).catch(() => {})
    }, BACKUP_IMMEDIATE_DEBOUNCE_MS)
  } else if (!batchTimerId) {
    scheduleNextBatch()
  }

  return getBackupSyncState()
}

export async function flushBackupNow({ reason = 'manual', scopeIds = null, categories = null } = {}) {
  if (!activeContext?.storeId) {
    return getBackupSyncState()
  }

  if (!firebaseReady || !firebaseDb || !canUseRemoteSync()) {
    updateState({
      status: 'pending',
      lastError: 'Backup remoto indisponivel na sessao atual.',
    })
    scheduleNextBatch()
    return getBackupSyncState()
  }

  if (inFlightPromise) {
    return inFlightPromise
  }

  const selectedScopeIds =
    scopeIds?.length > 0
      ? scopeIds.filter((scopeId) => dirtyScopeIds.has(scopeId) || reason === 'manual')
      : [...dirtyScopeIds].filter((scopeId) => {
          const scope = scopeDefinitionsById.get(scopeId)
          return categories?.length ? categories.includes(scope?.category) : true
        })

  if (!selectedScopeIds.length && reason !== 'manual') {
    scheduleNextBatch()
    return getBackupSyncState()
  }

  const effectiveScopeIds =
    selectedScopeIds.length > 0 ? selectedScopeIds : scopeDefinitions.map((scope) => scope.id)
  const attemptedAt = new Date().toISOString()
  updateState({
    status: 'syncing',
    lastAttemptedBackupAt: attemptedAt,
    lastError: '',
  })

  inFlightPromise = writeBackupRun({
    reason,
    selectedScopeIds: effectiveScopeIds,
    mode: categories?.length === 1 && categories[0] === 'logs' ? 'batch' : 'immediate',
  })
    .then((result) => {
      effectiveScopeIds.forEach((scopeId) => dirtyScopeIds.delete(scopeId))
      updateState({
        status: dirtyScopeIds.size > 0 ? 'pending' : 'idle',
        lastSuccessfulBackupAt: result.completedAtClient,
        lastDurationMs: result.durationMs,
        conflictCount: result.conflicts,
        statistics: {
          successfulRuns: Number(serviceState.statistics.successfulRuns ?? 0) + 1,
          failedRuns: Number(serviceState.statistics.failedRuns ?? 0),
          scopesSynced: Number(serviceState.statistics.scopesSynced ?? 0) + result.syncedScopes,
          recordsSynced: Number(serviceState.statistics.recordsSynced ?? 0) + result.recordsSynced,
        },
      })
      scheduleNextBatch()
      return getBackupSyncState()
    })
    .catch((error) => {
      updateState({
        status: 'error',
        lastError: serializeError(error),
        statistics: {
          successfulRuns: Number(serviceState.statistics.successfulRuns ?? 0),
          failedRuns: Number(serviceState.statistics.failedRuns ?? 0) + 1,
          scopesSynced: Number(serviceState.statistics.scopesSynced ?? 0),
          recordsSynced: Number(serviceState.statistics.recordsSynced ?? 0),
        },
      })
      scheduleNextBatch()
      throw error
    })
    .finally(() => {
      inFlightPromise = null
    })

  return inFlightPromise
}

export function shutdownBackupService() {
  if (typeof window !== 'undefined') {
    if (immediateTimerId) {
      window.clearTimeout(immediateTimerId)
    }

    if (batchTimerId) {
      window.clearTimeout(batchTimerId)
    }
  }

  immediateTimerId = null
  batchTimerId = null
  inFlightPromise = null
}

export {
  BACKUP_BATCH_INTERVAL_MS,
  BACKUP_SYNC_EVENT,
  BACKUP_STATUS_SETTING_ID,
  resolveBackupConflict,
  scopeDefinitions,
}
