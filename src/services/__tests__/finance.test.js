import { beforeEach, describe, expect, it, vi } from 'vitest'

const addDoc = vi.fn(async () => ({ id: 'closure-1' }))
const doc = vi.fn(() => 'doc-ref')
const canUseRemoteSync = vi.fn(() => false)
const guardRemoteSubscription = vi.fn()
const collection = vi.fn(() => 'collection-ref')
const serverTimestamp = vi.fn(() => 'server-timestamp')
const updateDoc = vi.fn(async () => undefined)

vi.mock('firebase/firestore', () => ({
  addDoc,
  collection,
  doc,
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp,
  updateDoc,
}))

vi.mock('../firebase', () => ({
  assertFirebaseReady: vi.fn(),
  canUseRemoteSync,
  firebaseDb: {},
  guardRemoteSubscription,
}))

describe('finance service', () => {
  beforeEach(() => {
    addDoc.mockClear()
    collection.mockClear()
    doc.mockClear()
    serverTimestamp.mockClear()
    updateDoc.mockClear()
    canUseRemoteSync.mockReturnValue(false)
    guardRemoteSubscription.mockReset()
  })

  it('normalizes finance totals before persisting a closure', async () => {
    const { createFinancialClosure } = await import('../finance')

    const closureId = await createFinancialClosure({
      storeId: 'store-1',
      tenantId: 'tenant-1',
      values: {
        cashierName: 'Caixa central',
        startDate: '2026-03-13',
        endDate: '2026-03-13',
        totalIncome: '150,50',
        totalExpense: '20',
        balance: '130.50',
      },
    })

    expect(closureId).toBe('closure-1')
    expect(addDoc).toHaveBeenCalledWith(
      'collection-ref',
      expect.objectContaining({
        totalIncome: 150.5,
        totalExpense: 20,
        balance: 130.5,
      }),
    )
  })

  it('validates required finance fields', async () => {
    const { validateManualExpenseInput } = await import('../finance')

    expect(() =>
      validateManualExpenseInput({
        amount: '10',
        occurredAt: '2026-03-13T09:00',
      }),
    ).toThrow('Informe a descricao da saida.')
  })

  it('falls back to an empty result when Firebase sync is unavailable', async () => {
    const { subscribeToFinancialEntries } = await import('../finance')
    const onData = vi.fn()

    const unsubscribe = subscribeToFinancialEntries('store-1', onData, vi.fn())

    expect(onData).toHaveBeenCalledWith([])
    expect(typeof unsubscribe).toBe('function')
  })

  it('validates and persists financial occurrences', async () => {
    const { createFinancialOccurrence } = await import('../finance')

    const occurrenceId = await createFinancialOccurrence({
      storeId: 'store-1',
      tenantId: 'tenant-1',
      values: {
        destinationSector: 'Financeiro / RH',
        category: 'Sangria / caixa',
        title: 'Possivel sangria duplicada',
        reference: 'CX-13',
        amount: 'R$ 120,00',
        cashierName: 'Caixa central',
        operatorName: 'Gabriel',
        occurredAt: '2026-03-13T09:00',
        description: 'Conferir se a sangria do turno foi registrada duas vezes.',
        printedAt: '2026-03-13T10:00:00.000Z',
      },
    })

    expect(occurrenceId).toBe('closure-1')
    expect(addDoc).toHaveBeenCalledWith(
      'collection-ref',
      expect.objectContaining({
        title: 'Possivel sangria duplicada',
        destinationSector: 'Financeiro / RH',
        category: 'Sangria / caixa',
        operatorName: 'Gabriel',
        status: 'pendente',
      }),
    )
  })

  it('updates occurrence status with timestamp fields', async () => {
    const { updateFinancialOccurrenceStatus } = await import('../finance')

    await updateFinancialOccurrenceStatus({
      storeId: 'store-1',
      occurrenceId: 'occ-1',
      status: 'resolvida',
    })

    expect(doc).toHaveBeenCalledWith({}, 'stores', 'store-1', 'financial_occurrences', 'occ-1')
    expect(updateDoc).toHaveBeenCalledWith(
      'doc-ref',
      expect.objectContaining({
        status: 'resolvida',
        statusUpdatedAt: 'server-timestamp',
        updatedAt: 'server-timestamp',
      }),
    )
  })
})
