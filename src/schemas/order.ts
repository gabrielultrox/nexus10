import { z } from 'zod'

import { OrderStatus, PaymentMethod } from '@/types'

export const orderItemSchema = z.object({
  productId: z.string().uuid('Produto deve ser um UUID valido.'),
  quantity: z
    .number()
    .int('Quantidade deve ser inteira.')
    .positive('Quantidade deve ser positiva.'),
  price: z.number().positive('Preco deve ser positivo.'),
  notes: z.string().trim().max(500, 'Observacoes devem ter no maximo 500 caracteres.').optional(),
})

export const createOrderSchema = z
  .object({
    customerId: z.string().uuid('Cliente deve ser um UUID valido.'),
    items: z.array(orderItemSchema).min(1, 'Informe ao menos um item.'),
    paymentMethod: z.nativeEnum(PaymentMethod),
    notes: z.string().trim().max(500, 'Observacoes devem ter no maximo 500 caracteres.').optional(),
  })
  .strict()

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
})

export const validateOrderTotalSchema = z
  .object({
    items: z.array(orderItemSchema).min(1, 'Informe ao menos um item.'),
    expectedTotal: z.number().positive('Total esperado deve ser positivo.'),
  })
  .superRefine((value, context) => {
    const total = value.items.reduce(
      (accumulator, item) => accumulator + item.quantity * item.price,
      0,
    )

    if (Math.abs(total - value.expectedTotal) > 0.01) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Total esperado divergente. Calculado ${total.toFixed(2)}.`,
        path: ['expectedTotal'],
      })
    }
  })

export type IOrderItemInput = z.infer<typeof orderItemSchema>
export type ICreateOrderInput = z.infer<typeof createOrderSchema>
export type IUpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>
export type IValidateOrderTotalInput = z.infer<typeof validateOrderTotalSchema>
