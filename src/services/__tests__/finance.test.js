import { beforeEach, describe, expect, it, vi } from 'vitest'

const addDoc = vi.fn(async () => ({ id: 'closure-1' }))
const canUseRemoteSync = vi.fn(() => false)
const guardRemoteSubscription = vi.fn()
const collection = vi.fn(() => 'collection-ref')
const serverTimestamp = vi.fn(() => 'server-timestamp')

vi.mock('firebase/firestore', () => ({
  addDoc,
  collection,
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp,
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
    serverTimestamp.mockClear()
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
})
