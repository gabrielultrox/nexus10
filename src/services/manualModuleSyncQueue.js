import {
  clearManualModuleRecords,
  deleteManualModuleRecord,
  saveManualModuleRecord,
} from './manualModuleService'
import { canUseRemoteSync } from './firebase'

const MANUAL_MODULE_SYNC_QUEUE_KEY = 'nexus-manual-module-sync-queue'

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

function createQueueId() {
  return `manual-sync-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function normalizeModulePaths(modulePaths) {
  return Array.isArray(modulePaths) ? modulePaths.filter(Boolean) : []
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

    if (existingOperation.type === 'save' && existingOperation.record?.id === nextOperation.record?.id) {
      return false
    }

    if (existingOperation.type === 'delete' && existingOperation.recordId === nextOperation.record?.id) {
      return false
    }
  }

  if (nextOperation.type === 'delete') {
    if (existingOperation.type === 'clear') {
      return false
    }

    if (existingOperation.type === 'save' && existingOperation.record?.id === nextOperation.recordId) {
      return false
    }

    if (existingOperation.type === 'delete' && existingOperation.recordId === nextOperation.recordId) {
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
    ...queue.filter((existingOperation) => shouldKeepExistingOperation(existingOperation, nextOperation)),
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

export async function flushManualModuleSyncQueue({ storeId, tenantId, modulePaths = [] }) {
  const normalizedModulePaths = normalizeModulePaths(modulePaths)
  const queue = loadQueue()

  if (!storeId || !canUseRemoteSync()) {
    return {
      flushedCount: 0,
      pendingCount: getManualModulePendingCount(normalizedModulePaths),
    }
  }

  const remainingQueue = []
  let flushedCount = 0

  for (const operation of queue) {
    if (normalizedModulePaths.length > 0 && !normalizedModulePaths.includes(operation.modulePath)) {
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

  return {
    flushedCount,
    pendingCount: normalizedModulePaths.length > 0
      ? remainingQueue.filter((operation) => normalizedModulePaths.includes(operation.modulePath)).length
      : remainingQueue.length,
  }
}
