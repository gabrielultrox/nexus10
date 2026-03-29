import { describe, expect, it } from 'vitest'

import { resolveLastWriteWinsConflict } from '../services/conflictResolver.ts'

describe('resolveLastWriteWinsConflict', () => {
  it('keeps local when local timestamp is newer', () => {
    const result = resolveLastWriteWinsConflict(
      {
        checksum: 'local',
        updatedAtClient: '2026-03-29T10:00:00.000Z',
      },
      {
        checksum: 'remote',
        updatedAtClient: '2026-03-29T09:00:00.000Z',
      },
    )

    expect(result.winner).toBe('local')
    expect(result.conflict).toBe(true)
    expect(result.mergedValue.checksum).toBe('local')
  })

  it('keeps remote when remote timestamp is newer', () => {
    const result = resolveLastWriteWinsConflict(
      {
        checksum: 'local',
        updatedAtClient: '2026-03-29T08:00:00.000Z',
      },
      {
        checksum: 'remote',
        updatedAtClient: '2026-03-29T09:00:00.000Z',
      },
    )

    expect(result.winner).toBe('remote')
    expect(result.conflict).toBe(true)
    expect(result.mergedValue.checksum).toBe('remote')
  })

  it('treats missing remote record as local win without conflict', () => {
    const result = resolveLastWriteWinsConflict(
      {
        checksum: 'local',
        updatedAtClient: '2026-03-29T08:00:00.000Z',
      },
      null,
    )

    expect(result.winner).toBe('local')
    expect(result.conflict).toBe(false)
  })
})
