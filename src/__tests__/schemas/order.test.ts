import { describe, expect, it } from 'vitest'

import {
  createOrderSchema,
  orderItemSchema,
} from '../../schemas/order'
import { ValidationError } from '../../services/errorHandler'
import { validateOrThrow } from '../../utils/validateData'

const VALID_PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_CUSTOMER_ID = '660e8400-e29b-41d4-a716-446655440000'

describe('Order Schemas', () => {
  it('validates a correct order item', () => {
    const result = orderItemSchema.parse({
      productId: VALID_PRODUCT_ID,
      quantity: 2,
      price: 19.9,
      notes: 'Sem gelo',
    })

    expect(result.productId).toBe(VALID_PRODUCT_ID)
    expect(result.quantity).toBe(2)
  })

  it('rejects negative quantity', () => {
    expect(() => orderItemSchema.parse({
      productId: VALID_PRODUCT_ID,
      quantity: -1,
      price: 10,
    })).toThrow()
  })

  it('validates a complete order payload', () => {
    const result = createOrderSchema.parse({
      customerId: VALID_CUSTOMER_ID,
      paymentMethod: 'PIX',
      notes: 'Entrega rapida',
      items: [
        {
          productId: VALID_PRODUCT_ID,
          quantity: 2,
          price: 15,
        },
      ],
    })

    expect(result.customerId).toBe(VALID_CUSTOMER_ID)
    expect(result.items).toHaveLength(1)
    expect(result.paymentMethod).toBe('PIX')
  })

  it('throws ValidationError with validateOrThrow for invalid payloads', () => {
    expect(() => validateOrThrow(createOrderSchema, {
      customerId: 'invalido',
      paymentMethod: 'DINHEIRO',
      items: [],
    }, { feature: 'orders' })).toThrow(ValidationError)
  })
})
