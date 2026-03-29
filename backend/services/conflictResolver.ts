export interface TimestampedConflictRecord {
  updatedAtClient?: string | null
  updatedAtServer?: string | null
  checksum?: string | null
  [key: string]: unknown
}

export interface ConflictResolutionResult<TRecord extends TimestampedConflictRecord> {
  winner: 'local' | 'remote'
  conflict: boolean
  localTimestamp: number
  remoteTimestamp: number
  mergedValue: TRecord
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

export function resolveLastWriteWinsConflict<TRecord extends TimestampedConflictRecord>(
  localRecord: TRecord,
  remoteRecord: TRecord | null | undefined,
): ConflictResolutionResult<TRecord> {
  const localTimestamp = parseTimestamp(localRecord.updatedAtClient ?? localRecord.updatedAtServer)
  const remoteTimestamp = parseTimestamp(
    remoteRecord?.updatedAtClient ?? remoteRecord?.updatedAtServer,
  )
  const conflict =
    Boolean(remoteRecord) &&
    String(localRecord.checksum ?? '') !== String(remoteRecord?.checksum ?? '')

  if (!remoteRecord || localTimestamp >= remoteTimestamp) {
    return {
      winner: 'local',
      conflict,
      localTimestamp,
      remoteTimestamp,
      mergedValue: localRecord,
    }
  }

  return {
    winner: 'remote',
    conflict,
    localTimestamp,
    remoteTimestamp,
    mergedValue: remoteRecord,
  }
}
