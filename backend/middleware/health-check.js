import fs from 'node:fs'
import path from 'node:path'

const SCHEDULER_STATE_DIRECTORY = path.resolve(process.cwd(), 'tmp')
const SCHEDULER_STATE_FILE_PATTERN = /^ze-delivery-scheduler-state(?:-[\w-]+)?\.json$/i
const STALE_HEARTBEAT_MS = 20 * 60 * 1000
const STALE_NEXT_SYNC_GRACE_MS = 10 * 60 * 1000

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

export function getZeDeliverySchedulerStateDirectory() {
  return SCHEDULER_STATE_DIRECTORY
}

export function readZeDeliverySchedulerStates() {
  if (!fs.existsSync(SCHEDULER_STATE_DIRECTORY)) {
    return []
  }

  return fs
    .readdirSync(SCHEDULER_STATE_DIRECTORY)
    .filter((fileName) => SCHEDULER_STATE_FILE_PATTERN.test(fileName))
    .map((fileName) => safeReadJson(path.join(SCHEDULER_STATE_DIRECTORY, fileName)))
    .filter(Boolean)
}

export function summarizeZeDeliverySchedulerStates(states = []) {
  if (!states.length) {
    return {
      status: 'unknown',
      lastSync: null,
      nextSync: null,
      errorCount: 0,
      successRate: null,
      staleWorkerCount: 0,
      staleWorkers: [],
      workers: [],
    }
  }

  const now = Date.now()
  const staleWorkers = states.filter((state) => {
    const updatedAtMs = state?.updatedAt ? Date.parse(state.updatedAt) : Number.NaN
    const nextSyncAtMs = state?.nextSyncAt ? Date.parse(state.nextSyncAt) : Number.NaN
    const isHeartbeatStale = Number.isFinite(updatedAtMs) && now - updatedAtMs > STALE_HEARTBEAT_MS
    const isNextSyncStale =
      Number.isFinite(nextSyncAtMs) &&
      now - nextSyncAtMs > STALE_NEXT_SYNC_GRACE_MS &&
      state?.status !== 'running' &&
      state?.status !== 'stopped'

    return isHeartbeatStale || isNextSyncStale
  })

  const successCount = states.reduce((total, state) => total + Number(state.successCount ?? 0), 0)
  const failureCount = states.reduce((total, state) => total + Number(state.failureCount ?? 0), 0)
  const errorCount = states.reduce((total, state) => total + Number(state.errorCount ?? 0), 0)

  const lastSync = states
    .map((state) => state.lastSyncAt)
    .filter(Boolean)
    .sort()
    .at(-1)
  const nextSync =
    states
      .map((state) => state.nextSyncAt)
      .filter(Boolean)
      .sort()[0] ?? null

  const statuses = new Set(states.map((state) => state.status).filter(Boolean))
  let status = 'healthy'

  if (statuses.has('running')) {
    status = 'running'
  } else if (statuses.has('degraded') || errorCount > 0 || staleWorkers.length > 0) {
    status = 'degraded'
  } else if (statuses.has('stopped')) {
    status = 'stopped'
  } else if (statuses.has('idle')) {
    status = 'idle'
  }

  return {
    status,
    lastSync: lastSync ?? null,
    nextSync,
    errorCount,
    successRate:
      successCount + failureCount > 0 ? successCount / (successCount + failureCount) : null,
    staleWorkerCount: staleWorkers.length,
    staleWorkers,
    workers: states,
  }
}
