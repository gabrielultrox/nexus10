import { beforeEach, describe, expect, it, vi } from 'vitest'

const occurrenceDocs = new Map()

const canUseRemoteSync = vi.fn(() => true)
const guardRemoteSubscription = vi.fn((startSubscription) => startSubscription())
function normalizeSegments(segments) {
  if (segments[0] && typeof segments[0] === 'object') {
    return segments.slice(1)
  }

  return segments
}

const collection = vi.fn((...segments) => normalizeSegments(segments).join('/'))
const doc = vi.fn((...segments) => normalizeSegments(segments).join('/'))
const orderBy = vi.fn((field, direction) => ({ field, direction }))
const query = vi.fn((...parts) => parts)
const onSnapshot = vi.fn()
const serverTimestamp = vi.fn(() => 'server-timestamp')
const getDoc = vi.fn(async (path) => ({
  exists: () => occurrenceDocs.has(path),
  data: () => occurrenceDocs.get(path) ?? {},
}))
const setDoc = vi.fn(async (path, payload, options = {}) => {
  const current = occurrenceDocs.get(path) ?? {}
  const nextValue = options.merge ? { ...current, ...payload } : payload
  occurrenceDocs.set(path, nextValue)
})
const updateDoc = vi.fn(async (path, payload) => {
  const current = occurrenceDocs.get(path)

  if (!current) {
    throw new Error('missing-doc')
  }

  occurrenceDocs.set(path, { ...current, ...payload })
})

vi.mock('firebase/firestore', () => ({
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
}))

vi.mock('../firebase', () => ({
  assertRemoteSyncReady: vi.fn(),
  canUseRemoteSync,
  firebaseDb: {},
  guardRemoteSubscription,
}))

describe('occurrence malote service', () => {
  beforeEach(() => {
    occurrenceDocs.clear()
    collection.mockClear()
    doc.mockClear()
    getDoc.mockClear()
    setDoc.mockClear()
    updateDoc.mockClear()
    canUseRemoteSync.mockReturnValue(true)
    onSnapshot.mockReset()
  })

  it('creates and updates remote occurrence malote entries by source record id', async () => {
    const { subscribeToOccurrenceMaloteHistory, upsertOccurrenceMaloteEntry } = await import(
      '../occurrenceMalote'
    )

    await upsertOccurrenceMaloteEntry({
      storeId: 'store-1',
      tenantId: 'tenant-1',
      record: {
        id: 'occ-1',
        code: 'OC-301',
        type: 'Sangria possivelmente duplicada',
        owner: 'Gabriel',
        status: 'Em triagem',
      },
      session: { operatorName: 'Gabriel' },
    })

    await upsertOccurrenceMaloteEntry({
      storeId: 'store-1',
      tenantId: 'tenant-1',
      record: {
        id: 'occ-1',
        code: 'OC-301',
        type: 'Sangria possivelmente duplicada',
        owner: 'Gabriel',
        status: 'Resolvida',
      },
      session: { operatorName: 'Gabriel' },
    })

    const path = 'stores/store-1/financial_occurrences/malote-occ-1'
    const remoteEntry = occurrenceDocs.get(path)

    expect(remoteEntry).toEqual(
      expect.objectContaining({
        sourceRecordId: 'occ-1',
        code: 'OC-301',
        status: 'Resolvida',
        printCount: 2,
        flow: 'malote',
      }),
    )

    const onData = vi.fn()
    onSnapshot.mockImplementation((queryRef, next) => {
      next({
        docs: [
          {
            id: 'malote-occ-1',
            data: () => remoteEntry,
          },
        ],
      })
      return () => {}
    })

    subscribeToOccurrenceMaloteHistory('store-1', onData)

    expect(onData).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'malote-occ-1',
        sourceRecordId: 'occ-1',
        status: 'Resolvida',
      }),
    ])
  })

  it('attaches protocol and signature to an existing remote entry', async () => {
    const { attachOccurrenceMaloteReceipt, upsertOccurrenceMaloteEntry } = await import(
      '../occurrenceMalote'
    )

    await upsertOccurrenceMaloteEntry({
      storeId: 'store-1',
      tenantId: 'tenant-1',
      record: {
        id: 'occ-2',
        code: 'OC-401',
        type: 'Conferencia de caixa',
        owner: 'Fernanda',
        status: 'Encaminhada',
      },
      session: { operatorName: 'Fernanda' },
    })

    await attachOccurrenceMaloteReceipt({
      storeId: 'store-1',
      entryId: 'malote-occ-2',
      values: {
        protocolCode: 'MAL-123',
        receivedBy: 'RH',
        receivedAt: '2026-04-04T19:10',
        digitalSignature: 'RH / Carla',
        notes: 'Recebido no malote do fechamento.',
      },
      session: { operatorName: 'Gabriel' },
    })

    expect(occurrenceDocs.get('stores/store-1/financial_occurrences/malote-occ-2')).toEqual(
      expect.objectContaining({
        protocolCode: 'MAL-123',
        receivedBy: 'RH',
        digitalSignature: 'RH / Carla',
        notes: 'Recebido no malote do fechamento.',
      }),
    )
  })

  it('builds excel and pdf exports with the same malote concept as the paper', async () => {
    const { buildOccurrenceMaloteExcel, buildOccurrenceMalotePdfHtml } = await import(
      '../occurrenceMalote'
    )

    const items = [
      {
        destinationSector: 'Financeiro / RH',
        category: 'Ocorrencia operacional',
        title: 'Ocorrencia OC-999',
        reference: 'OC-999',
        amount: 'R$ 130,50',
        operatorName: 'Gabriel',
        occurredAt: '2026-04-04T20:00:00.000Z',
        description: 'Talvez tenha uma sangria duplicada no valor de 130,50.',
        status: 'Resolvida',
        protocolCode: 'MAL-999',
        receivedBy: 'Financeiro',
        receivedAt: '2026-04-04T20:00:00.000Z',
        digitalSignature: 'Financeiro / Ana',
        notes: 'Conferido no malote.',
      },
    ]

    const excel = buildOccurrenceMaloteExcel(items)
    const pdf = buildOccurrenceMalotePdfHtml(items)

    expect(excel).toContain('Descricao detalhada')
    expect(excel).toContain('Talvez tenha uma sangria duplicada')
    expect(pdf).toContain('Descricao detalhada')
    expect(pdf).toContain('Financeiro / Ana')
    expect(pdf).toContain('Ocorrencia OC-999')
  })
})
