import { describe, expect, it } from 'vitest'

describe('analytics builder', () => {
  it('builds analytics snapshot for a synthetic 50k+ dataset', async () => {
    const { __analyticsTestUtils } = await import('../services/analyticsBuilder.ts')

    const sales = Array.from({ length: 20000 }, (_, index) => ({
      id: `sale-${index}`,
      channel: index % 5 === 0 ? 'IFOOD' : index % 7 === 0 ? 'ZE_DELIVERY' : 'PDV',
      customerId: `customer-${index % 10000}`,
      createdAt: new Date(Date.UTC(2026, 2, (index % 30) + 1, index % 24, 0, 0)),
      total: 20 + (index % 17),
      discountValue: index % 3,
      subtotal: 18 + (index % 16),
      items: [
        {
          productId: `product-${index % 200}`,
          productName: `Produto ${index % 200}`,
          category: ['Destilados', 'Cerveja', 'Combo', 'Conveniencia'][index % 4],
          quantity: 1 + (index % 3),
          unitPrice: 10 + (index % 7),
          totalPrice: 20 + (index % 17),
          cost: 8 + (index % 5),
        },
      ],
    }))

    const orders = Array.from({ length: 20000 }, (_, index) => ({
      id: `order-${index}`,
      channel: index % 4 === 0 ? 'IFOOD' : index % 6 === 0 ? 'ZE_DELIVERY' : 'PDV',
      status: index % 9 === 0 ? 'CANCELLED' : 'DELIVERED',
      customerId: `customer-${index % 10000}`,
      courierName: `Entregador ${index % 80}`,
      createdAt: new Date(Date.UTC(2026, 2, (index % 30) + 1, index % 24, 0, 0)),
      updatedAt: new Date(Date.UTC(2026, 2, (index % 30) + 1, (index % 24) + 1, 0, 0)),
      deliveredAt: new Date(Date.UTC(2026, 2, (index % 30) + 1, (index % 24) + 1, 5, 0)),
      cancellationReason: index % 9 === 0 ? 'Cliente desistiu' : 'Sem motivo informado',
    }))

    const customers = Array.from({ length: 10000 }, (_, index) => ({
      id: `customer-${index}`,
      createdAt: new Date(Date.UTC(2026, 2, (index % 30) + 1, 12, 0, 0)),
    }))

    const startedAt = Date.now()
    const snapshot = __analyticsTestUtils.buildAnalyticsSnapshotFromRecords({
      storeId: 'store-a',
      startDate: '2026-03-01',
      endDate: '2026-03-30',
      moduleFilter: 'all',
      compareBy: 'previous_period',
      sales,
      orders,
      customers,
      productsCount: 200,
    })
    const elapsed = Date.now() - startedAt

    expect(snapshot.metrics).toHaveLength(5)
    expect(snapshot.charts).toHaveLength(5)
    expect(snapshot.highlights.bestProduct).not.toBeNull()
    expect(snapshot.metadata.records.sales).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(5000)
  })
})
