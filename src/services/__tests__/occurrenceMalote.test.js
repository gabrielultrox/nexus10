import { beforeEach, describe, expect, it } from 'vitest'

describe('occurrence malote service', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('creates and updates occurrence malote entries by source record id', async () => {
    const { loadOccurrenceMaloteHistory, upsertOccurrenceMaloteEntry } = await import(
      '../occurrenceMalote'
    )

    upsertOccurrenceMaloteEntry({
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

    upsertOccurrenceMaloteEntry({
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

    const items = loadOccurrenceMaloteHistory('store-1')

    expect(items).toHaveLength(1)
    expect(items[0]).toEqual(
      expect.objectContaining({
        sourceRecordId: 'occ-1',
        code: 'OC-301',
        status: 'Resolvida',
        printCount: 2,
      }),
    )
  })

  it('attaches protocol and signature to an existing entry', async () => {
    const {
      attachOccurrenceMaloteReceipt,
      loadOccurrenceMaloteHistory,
      upsertOccurrenceMaloteEntry,
    } = await import('../occurrenceMalote')

    upsertOccurrenceMaloteEntry({
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

    const [entry] = loadOccurrenceMaloteHistory('store-1')

    attachOccurrenceMaloteReceipt({
      storeId: 'store-1',
      entryId: entry.id,
      values: {
        protocolCode: 'MAL-123',
        receivedBy: 'RH',
        receivedAt: '2026-04-04T19:10',
        digitalSignature: 'RH / Carla',
        notes: 'Recebido no malote do fechamento.',
      },
      session: { operatorName: 'Gabriel' },
    })

    const [updatedEntry] = loadOccurrenceMaloteHistory('store-1')

    expect(updatedEntry).toEqual(
      expect.objectContaining({
        protocolCode: 'MAL-123',
        receivedBy: 'RH',
        digitalSignature: 'RH / Carla',
        notes: 'Recebido no malote do fechamento.',
      }),
    )
  })

  it('builds excel and pdf exports with protocol data', async () => {
    const { buildOccurrenceMaloteExcel, buildOccurrenceMalotePdfHtml } = await import(
      '../occurrenceMalote'
    )

    const items = [
      {
        code: 'OC-999',
        title: 'Ocorrencia OC-999',
        type: 'Sangria em revisao',
        owner: 'Gabriel',
        status: 'Resolvida',
        destinationSector: 'Financeiro / RH',
        protocolCode: 'MAL-999',
        receivedBy: 'Financeiro',
        receivedAt: '2026-04-04T20:00:00.000Z',
        digitalSignature: 'Financeiro / Ana',
        notes: 'Conferido no malote.',
      },
    ]

    expect(buildOccurrenceMaloteExcel(items)).toContain('MAL-999')
    expect(buildOccurrenceMalotePdfHtml(items)).toContain('Financeiro / Ana')
  })
})
