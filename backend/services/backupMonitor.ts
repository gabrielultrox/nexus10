import { hasFirebaseAdminConfig } from '../config/env.js'
import { getAdminFirestore } from '../firebaseAdmin.js'
import { resolveLastWriteWinsConflict } from './conflictResolver.js'

interface BackupStatusRecord {
  storeId?: string
  lastSuccessfulBackupAt?: string | null
  lastAttemptedBackupAt?: string | null
  lastError?: string | null
  lastDurationMs?: number | null
  conflictCount?: number | null
  pendingScopes?: string[] | null
  statistics?: {
    totalRuns?: number
    successfulRuns?: number
    failedRuns?: number
    scopesSynced?: number
    recordsSynced?: number
  } | null
  [key: string]: unknown
}

function parseTimestamp(value: unknown): number {
  if (!value) {
    return 0
  }

  if (typeof value === 'object' && value !== null) {
    const withToDate = value as { toDate?: () => Date }
    const withSeconds = value as { seconds?: number }

    if (typeof withToDate.toDate === 'function') {
      return withToDate.toDate().getTime()
    }

    if (typeof withSeconds.seconds === 'number') {
      return withSeconds.seconds * 1000
    }
  }

  const parsed = new Date(String(value)).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function isStale(lastSuccessfulBackupAt: unknown, staleAfterMs: number): boolean {
  const timestamp = parseTimestamp(lastSuccessfulBackupAt)

  if (!timestamp) {
    return true
  }

  return Date.now() - timestamp > staleAfterMs
}

export async function getBackupMonitoringSnapshot() {
  if (!hasFirebaseAdminConfig()) {
    return {
      enabled: false,
      generatedAt: new Date().toISOString(),
      summary: {
        totalStores: 0,
        healthyStores: 0,
        staleStores: 0,
        storesWithErrors: 0,
        totalConflicts: 0,
        averageDurationMs: 0,
        successRate: 0,
      },
      stores: [],
    }
  }

  const firestore = getAdminFirestore()
  const staleAfterMs = 24 * 60 * 60 * 1000
  const storesSnapshot = await firestore.collection('stores').get()
  const storeStatuses = await Promise.all(
    storesSnapshot.docs.map(async (storeDocument: any) => {
      const storeId = storeDocument.id
      const statusSnapshot = await firestore
        .collection('stores')
        .doc(storeId)
        .collection('settings')
        .doc('backup_status')
        .get()
      const status = (statusSnapshot.exists ? (statusSnapshot.data() as BackupStatusRecord) : null) ?? null
      const statistics = status?.statistics ?? {}
      const pendingScopes = Array.isArray(status?.pendingScopes) ? status.pendingScopes : []

      return {
        storeId,
        storeName: String(storeDocument.data()?.name ?? storeId),
        healthy: !isStale(status?.lastSuccessfulBackupAt, staleAfterMs) && !status?.lastError,
        stale: isStale(status?.lastSuccessfulBackupAt, staleAfterMs),
        lastSuccessfulBackupAt: status?.lastSuccessfulBackupAt ?? null,
        lastAttemptedBackupAt: status?.lastAttemptedBackupAt ?? null,
        lastError: String(status?.lastError ?? ''),
        pendingScopes,
        conflictCount: Number(status?.conflictCount ?? 0),
        lastDurationMs: Number(status?.lastDurationMs ?? 0),
        successRate:
          Number(statistics.totalRuns ?? 0) > 0
            ? Number(
                (
                  (Number(statistics.successfulRuns ?? 0) / Number(statistics.totalRuns ?? 0)) *
                  100
                ).toFixed(2),
              )
            : 0,
        syncedRecords: Number(statistics.recordsSynced ?? 0),
      }
    }),
  )

  const totalStores = storeStatuses.length
  const staleStores = storeStatuses.filter((store) => store.stale).length
  const storesWithErrors = storeStatuses.filter((store) => Boolean(store.lastError)).length
  const healthyStores = storeStatuses.filter((store) => store.healthy).length
  const totalConflicts = storeStatuses.reduce((total, store) => total + store.conflictCount, 0)
  const averageDurationMs =
    totalStores > 0
      ? Number(
          (
            storeStatuses.reduce((total, store) => total + Number(store.lastDurationMs || 0), 0) /
            totalStores
          ).toFixed(2),
        )
      : 0
  const successRate =
    totalStores > 0
      ? Number(
          (
            storeStatuses.reduce((total, store) => total + Number(store.successRate || 0), 0) /
            totalStores
          ).toFixed(2),
        )
      : 0

  const topStores = storeStatuses
    .sort((left, right) => {
      if (left.stale !== right.stale) {
        return left.stale ? -1 : 1
      }

      if (Boolean(left.lastError) !== Boolean(right.lastError)) {
        return left.lastError ? -1 : 1
      }

      return parseTimestamp(right.lastSuccessfulBackupAt) - parseTimestamp(left.lastSuccessfulBackupAt)
    })
    .slice(0, 10)

  return {
    enabled: true,
    generatedAt: new Date().toISOString(),
    summary: {
      totalStores,
      healthyStores,
      staleStores,
      storesWithErrors,
      totalConflicts,
      averageDurationMs,
      successRate,
    },
    stores: topStores,
  }
}

export async function writeDailyBackupAuditReport() {
  if (!hasFirebaseAdminConfig()) {
    return {
      written: false,
      reason: 'firebase-admin-disabled',
    }
  }

  const firestore = getAdminFirestore()
  const snapshot = await getBackupMonitoringSnapshot()
  const reportDate = new Date().toISOString().slice(0, 10)
  const reportRef = firestore.collection('ops_reports').doc('backup').collection('daily').doc(reportDate)
  const existingSnapshot = await reportRef.get()
  const candidate = {
    reportDate,
    generatedAtClient: new Date().toISOString(),
    updatedAtClient: new Date().toISOString(),
    checksum: JSON.stringify(snapshot.summary),
    snapshot,
  }
  const resolution = resolveLastWriteWinsConflict(
    candidate,
    existingSnapshot.exists ? (existingSnapshot.data() as typeof candidate) : null,
  )

  await reportRef.set(
    {
      ...resolution.mergedValue,
      checksum: String(candidate.checksum),
      updatedAtServer: new Date().toISOString(),
    },
    { merge: true },
  )

  return {
    written: true,
    winner: resolution.winner,
    reportDate,
    staleStores: snapshot.summary.staleStores,
  }
}
