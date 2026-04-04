import { beforeEach, describe, expect, it, vi } from 'vitest'

const canUseRemoteSync = vi.fn(() => false)
const guardRemoteSubscription = vi.fn()
const subscribeToExternalOrders = vi.fn(() => vi.fn())

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
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

vi.mock('../externalOrders', () => ({
  subscribeToExternalOrders,
}))

describe('orders service', () => {
  beforeEach(() => {
    canUseRemoteSync.mockReturnValue(false)
    guardRemoteSubscription.mockReset()
    subscribeToExternalOrders.mockClear()
  })

  it('calculates validated order totals from items and pricing fields', async () => {
    const { validateOrderInput } = await import('../orders')

    const result = validateOrderInput({
      code: 'PED-001',
      source: 'BALCAO',
      customerId: 'customer-1',
      customerSnapshot: { id: 'customer-1', name: 'Joao' },
      items: [
        {
          productId: 'product-1',
          productSnapshot: { id: 'product-1', name: 'Pizza media' },
          quantity: 2,
          unitPrice: 25,
        },
      ],
      totals: {
        subtotal: 50,
        freight: 5,
        extraAmount: 2,
        discountPercent: 0,
        discountValue: 1,
        total: 56,
      },
      paymentPreview: {
        method: 'PIX',
      },
    })

    expect(result.items[0].totalPrice).toBe(50)
    expect(result.totals).toEqual({
      subtotal: 50,
      freight: 5,
      extraAmount: 2,
      discountPercent: 0,
      discountValue: 1,
      total: 56,
    })
    expect(result.paymentPreview.amount).toBe(56)
  })

  it('validates required order fields', async () => {
    const { validateOrderInput } = await import('../orders')

    expect(() =>
      validateOrderInput({
        source: 'BALCAO',
        paymentPreview: { method: 'PIX' },
        items: [],
      }),
    ).toThrow('O pedido precisa ter ao menos um item.')
  })

  it('falls back to an empty result when Firebase sync is unavailable', async () => {
    const { subscribeToOrders } = await import('../orders')
    const onData = vi.fn()

    const unsubscribe = subscribeToOrders('store-1', onData, vi.fn())

    expect(onData).toHaveBeenCalledWith([])
    expect(subscribeToExternalOrders).not.toHaveBeenCalled()
    expect(typeof unsubscribe).toBe('function')
  })
})
