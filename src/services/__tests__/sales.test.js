import { beforeEach, describe, expect, it, vi } from 'vitest'

const canUseRemoteSync = vi.fn(() => false)
const guardRemoteSubscription = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
}))

vi.mock('../backendApi', () => ({
  requestBackend: vi.fn(),
}))

vi.mock('../firebase', () => ({
  assertFirebaseReady: vi.fn(),
  canUseRemoteSync,
  createRemoteSyncError: vi.fn(() => new Error('Remote sync unavailable')),
  firebaseDb: {},
  guardRemoteSubscription,
}))

describe('sales service', () => {
  beforeEach(() => {
    canUseRemoteSync.mockReturnValue(false)
    guardRemoteSubscription.mockReset()
  })

  it('calculates validated sale totals from items and pricing fields', async () => {
    const { validateSaleInput } = await import('../sales')

    const result = validateSaleInput({
      code: 'VEN-001',
      channel: 'BALCAO',
      customerId: 'customer-1',
      customerSnapshot: { id: 'customer-1', name: 'Maria' },
      items: [
        {
          productId: 'product-1',
          productSnapshot: { id: 'product-1', name: 'Combo executivo' },
          quantity: 3,
          unitPrice: 12,
        },
      ],
      totals: {
        subtotal: 36,
        freight: 3,
        extraAmount: 1,
        discountPercent: 0,
        discountValue: 2,
        total: 38,
      },
      paymentMethod: 'PIX',
    })

    expect(result.items[0].totalPrice).toBe(36)
    expect(result.totals.total).toBe(38)
    expect(result.payment.amount).toBe(38)
  })

  it('validates required sale fields', async () => {
    const { validateSaleInput } = await import('../sales')

    expect(() =>
      validateSaleInput({
        channel: 'BALCAO',
        items: [
          {
            productSnapshot: { name: 'Item teste' },
            quantity: 1,
            unitPrice: 10,
          },
        ],
      }),
    ).toThrow('Informe a forma de pagamento.')
  })

  it('falls back to an empty result when Firebase sync is unavailable', async () => {
    const { subscribeToSales } = await import('../sales')
    const onData = vi.fn()

    const unsubscribe = subscribeToSales('store-1', onData, vi.fn())

    expect(onData).toHaveBeenCalledWith([])
    expect(typeof unsubscribe).toBe('function')
  })
})
