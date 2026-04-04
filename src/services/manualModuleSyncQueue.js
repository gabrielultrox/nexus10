import {
  clearManualModuleRecords,
  deleteManualModuleRecord,
  saveManualModuleRecord,
} from './manualModuleService'
import { canUseRemoteSync } from './firebase'

const MANUAL_MODULE_SYNC_QUEUE_KEY = 'nexus-manual-module-sync-queue'
const MANUAL_MODULE_SYNC_HISTORY_KEY = 'nexus-manual-module-sync-history'
const MANUAL_MODULE_LOCAL_MODE_KEY = 'nexus-manual-module-local-only'
const MANUAL_MODULE_MIN_FLUSH_INTERVAL_MS = 15000

let activeFlushPromise = null
let lastFlushFinishedAt = 0
let lastFlushScopeKey = ''
let lastFlushResult = null

function getStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}

function loadQueue() {
  const storage = getStorage()

  if (!storage) {
    return []
  }

  try {
    const rawValue = storage.getItem(MANUAL_MODULE_SYNC_QUEUE_KEY)

    if (!rawValue) {
      return []
    }

    const parsedValue = JSON.parse(rawValue)
    return Array.isArray(parsedValue) ? parsedValue : []
  } catch {
    return []
  }
}

function saveQueue(queue) {
  const storage = getStorage()

  if (!storage) {
    return
  }

  try {
    storage.setItem(MANUAL_MODULE_SYNC_QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // Ignore queue write failures to keep the operation flow usable.
  }
}

function loadHistory() {
  const storage = getStorage()

  if (!storage) {
    return []
  }

  try {
    const rawValue = storage.getItem(MANUAL_MODULE_SYNC_HISTORY_KEY)
    const parsedValue = JSON.parse(rawValue ?? '[]')
    return Array.isArray(parsedValue) ? parsedValue : []
  } catch {
    return []
  }
}

function saveHistory(history) {
  const storage = getStorage()

  if (!storage) {
    return
  }

  try {
    storage.setItem(MANUAL_MODULE_SYNC_HISTORY_KEY, JSON.stringify(history))
  } catch {
    // Ignore history write failures to keep the operation flow usable.
  }
}

function createQueueId() {
  return `manual-sync-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function normalizeModulePaths(modulePaths) {
  return Array.isArray(modulePaths) ? modulePaths.filter(Boolean) : []
}

function buildFlushScopeKey(storeId, modulePaths) {
  return `${storeId ?? 'unknown-store'}::${normalizeModulePaths(modulePaths).sort().join(',')}`
}

function shouldKeepExistingOperation(existingOperation, nextOperation) {
  if (existingOperation.modulePath !== nextOperation.modulePath) {
    return true
  }

  if (nextOperation.type === 'clear') {
    return false
  }

  if (nextOperation.type === 'save') {
    if (existingOperation.type === 'clear') {
      return false
    }

    if (
      existingOperation.type === 'save' &&
      existingOperation.record?.id === nextOperation.record?.id
    ) {
      return false
    }

    if (
      existingOperation.type === 'delete' &&
      existingOperation.recordId === nextOperation.record?.id
    ) {
      return false
    }
  }

  if (nextOperation.type === 'delete') {
    if (existingOperation.type === 'clear') {
      return false
    }

    if (
      existingOperation.type === 'save' &&
      existingOperation.record?.id === nextOperation.recordId
    ) {
      return false
    }

    if (
      existingOperation.type === 'delete' &&
      existingOperation.recordId === nextOperation.recordId
    ) {
      return false
    }
  }

  return true
}

export function enqueueManualModuleSyncOperation(operation) {
  const queue = loadQueue()
  const nextOperation = {
    ...operation,
    queueId: operation.queueId ?? createQueueId(),
    queuedAt: operation.queuedAt ?? new Date().toISOString(),
  }
  const nextQueue = [
    ...queue.filter((existingOperation) =>
      shouldKeepExistingOperation(existingOperation, nextOperation),
    ),
    nextOperation,
  ]

  saveQueue(nextQueue)
  return nextQueue
}

export function getManualModulePendingCount(modulePaths = []) {
  const normalizedModulePaths = normalizeModulePaths(modulePaths)
  const queue = loadQueue()

  if (normalizedModulePaths.length === 0) {
    return queue.length
  }

  return queue.filter((operation) => normalizedModulePaths.includes(operation.modulePath)).length
}

export function getManualModuleSyncHistory(modulePaths = [], limit = 6) {
  const normalizedModulePaths = normalizeModulePaths(modulePaths)
  const history = loadHistory()

  const filteredHistory =
    normalizedModulePaths.length === 0
      ? history
      : history.filter((entry) =>
          entry.modulePaths?.some((modulePath) => normalizedModulePaths.includes(modulePath)),
        )

  return filteredHistory.slice(0, limit)
}

function recordManualModuleSyncHistory(entry) {
  const history = loadHistory()
  const nextHistory = [entry, ...history].slice(0, 20)
  saveHistory(nextHistory)
}

export function getManualModuleLocalMode() {
  const storage = getStorage()

  if (!storage) {
    return false
  }

  return storage.getItem(MANUAL_MODULE_LOCAL_MODE_KEY) === 'true'
}

export function setManualModuleLocalMode(enabled) {
  const storage = getStorage()

  if (!storage) {
    return false
  }

  storage.setItem(MANUAL_MODULE_LOCAL_MODE_KEY, enabled ? 'true' : 'false')
  return enabled
}

export async function flushManualModuleSyncQueue({ storeId, tenantId, modulePaths = [] }) {
  const normalizedModulePaths = normalizeModulePaths(modulePaths)
  const queue = loadQueue()
  const scopeKey = buildFlushScopeKey(storeId, normalizedModulePaths)
  const pendingCount = getManualModulePendingCount(normalizedModulePaths)

  if (!storeId || !canUseRemoteSync()) {
    return {
      flushedCount: 0,
      pendingCount,
    }
  }

  if (pendingCount === 0) {
    return {
      flushedCount: 0,
      pendingCount: 0,
    }
  }

  if (activeFlushPromise) {
    return activeFlushPromise
  }

  if (
    lastFlushResult &&
    lastFlushScopeKey === scopeKey &&
    Date.now() - lastFlushFinishedAt < MANUAL_MODULE_MIN_FLUSH_INTERVAL_MS
  ) {
    return {
      ...lastFlushResult,
      pendingCount,
    }
  }

  activeFlushPromise = (async () => {
    const remainingQueue = []
    let flushedCount = 0

    for (const operation of queue) {
      if (
        normalizedModulePaths.length > 0 &&
        !normalizedModulePaths.includes(operation.modulePath)
      ) {
        remainingQueue.push(operation)
        continue
      }

      try {
        if (operation.type === 'save') {
          await saveManualModuleRecord({
            storeId,
            tenantId,
            modulePath: operation.modulePath,
            dailyResetHour: operation.dailyResetHour ?? null,
            record: operation.record,
          })
        } else if (operation.type === 'delete') {
          await deleteManualModuleRecord({
            storeId,
            modulePath: operation.modulePath,
            recordId: operation.recordId,
          })
        } else if (operation.type === 'clear') {
          await clearManualModuleRecords({
            storeId,
            modulePath: operation.modulePath,
            storageKey: operation.storageKey,
            initialRecords: operation.initialRecords ?? [],
            dailyResetHour: operation.dailyResetHour ?? null,
          })
        } else {
          remainingQueue.push(operation)
          continue
        }

        flushedCount += 1
      } catch {
        remainingQueue.push(operation)
      }
    }

    saveQueue(remainingQueue)

    if (flushedCount > 0) {
      recordManualModuleSyncHistory({
        id: createQueueId(),
        type: 'flush',
        flushedCount,
        pendingCount:
          normalizedModulePaths.length > 0
            ? remainingQueue.filter((operation) =>
                normalizedModulePaths.includes(operation.modulePath),
              ).length
            : remainingQueue.length,
        modulePaths:
          normalizedModulePaths.length > 0
            ? normalizedModulePaths
            : Array.from(new Set(queue.map((operation) => operation.modulePath))),
        createdAt: new Date().toISOString(),
      })
    }

    const result = {
      flushedCount,
      pendingCount:
        normalizedModulePaths.length > 0
          ? remainingQueue.filter((operation) =>
              normalizedModulePaths.includes(operation.modulePath),
            ).length
          : remainingQueue.length,
    }

    lastFlushFinishedAt = Date.now()
    lastFlushScopeKey = scopeKey
    lastFlushResult = result

    return result
  })()

  try {
    return await activeFlushPromise
  } finally {
    activeFlushPromise = null
  }
}
