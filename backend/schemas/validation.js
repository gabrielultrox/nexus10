import { z } from 'zod'

const nonEmptyString = (label) =>
  z.preprocess(
    (value) => (value == null ? '' : value),
    z.string().trim().min(1, `${label} e obrigatorio.`),
  )
const isoDateTimeString = (label) =>
  z.preprocess(
    (value) => (value == null ? '' : value),
    z.string().trim().datetime(`${label} deve estar em formato ISO valido.`),
  )

const merchantSchema = z
  .union([
    nonEmptyString('merchant'),
    z
      .object({
        id: nonEmptyString('merchant.id'),
        name: nonEmptyString('merchant.name').optional(),
      })
      .passthrough(),
  ])
  .optional()

const orderItemSchema = z
  .object({
    id: z.string().trim().optional(),
    productId: nonEmptyString('productId'),
    quantity: z.coerce.number().int().positive('quantity deve ser maior que zero.'),
    price: z.coerce.number().positive('price deve ser maior que zero.').optional(),
    unitPrice: z.coerce.number().positive('unitPrice deve ser maior que zero.').optional(),
    notes: z.string().trim().max(500, 'notes deve ter no maximo 500 caracteres.').optional(),
  })
  .superRefine((value, context) => {
    if (value.price == null && value.unitPrice == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe price ou unitPrice no item.',
        path: ['price'],
      })
    }
  })

const orderStatusSchema = z.enum(
  ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SENT', 'DELIVERED', 'CANCELLED'],
  'status do pedido invalido.',
)

const financeEntryRefSchema = z.union([
  nonEmptyString('entries'),
  z.object({
    entryId: nonEmptyString('entries.entryId'),
    amount: z.coerce.number().positive('entries.amount deve ser maior que zero.').optional(),
  }),
])

export const authLoginSchema = z
  .object({
    pin: z
      .string()
      .trim()
      .regex(/^\d{4,6}$/, 'PIN deve conter entre 4 e 6 digitos.')
      .optional(),
    password: z
      .string()
      .trim()
      .regex(/^\d{4,6}$/, 'PIN deve conter entre 4 e 6 digitos.')
      .optional(),
    operator: nonEmptyString('operator').optional(),
    operatorName: nonEmptyString('operator').optional(),
    storeId: z.string().trim().min(1, 'storeId e obrigatorio.').nullable().optional(),
  })
  .superRefine((value, context) => {
    if (!value.pin && !value.password) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PIN e obrigatorio.',
        path: ['pin'],
      })
    }

    if (!value.operator && !value.operatorName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'operator e obrigatorio.',
        path: ['operator'],
      })
    }
  })
  .transform((value) => ({
    mode: 'login',
    pin: value.pin ?? value.password,
    operator: value.operator ?? value.operatorName,
    storeId: value.storeId ?? null,
  }))

export const authSessionSchema = z.object({
  token: nonEmptyString('token'),
})

export const authSessionRouteSchema = z
  .unknown()
  .superRefine((value, context) => {
    const schema =
      value && typeof value === 'object' && value !== null && 'token' in value
        ? authSessionSchema
        : authLoginSchema
    const result = schema.safeParse(value)

    if (!result.success) {
      for (const issue of result.error.issues) {
        context.addIssue(issue)
      }
    }
  })
  .transform((value) => {
    const schema =
      value && typeof value === 'object' && value !== null && 'token' in value
        ? authSessionSchema
        : authLoginSchema

    return schema.parse(value)
  })

export const createOrderSchema = z
  .object({
    orderId: z.string().trim().min(1, 'orderId e obrigatorio.').optional(),
    code: z.string().trim().min(1, 'orderId e obrigatorio.').optional(),
    merchant: merchantSchema,
    source: z.string().trim().min(1, 'merchant e obrigatorio.').optional(),
    items: z.array(orderItemSchema).min(1, 'A ordem deve ter ao menos um item.'),
    date: isoDateTimeString('date'),
  })
  .superRefine((value, context) => {
    if (!value.orderId && !value.code) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'orderId e obrigatorio.',
        path: ['orderId'],
      })
    }

    if (!value.merchant && !value.source) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'merchant e obrigatorio.',
        path: ['merchant'],
      })
    }
  })
  .transform((value) => ({
    orderId: value.orderId ?? value.code,
    merchant: value.merchant ?? value.source,
    items: value.items,
    date: value.date,
    raw: value,
  }))

export const updateOrderSchema = z
  .object({
    status: orderStatusSchema.optional(),
    updates: z
      .object({
        courierId: z.string().trim().optional(),
        notes: z
          .string()
          .trim()
          .max(500, 'updates.notes deve ter no maximo 500 caracteres.')
          .optional(),
        paymentMethod: z.enum(['CASH', 'CARD', 'PIX']).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
  })
  .superRefine((value, context) => {
    if (!value.status && (!value.updates || Object.keys(value.updates).length === 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe status ou updates.',
        path: ['status'],
      })
    }
  })

export const createFinancialTransactionSchema = z.object({
  type: z.enum(['entrada', 'saida', 'estorno', 'ajuste', 'pendencia'], 'type financeiro invalido.'),
  amount: z.coerce.number().positive('amount deve ser maior que zero.'),
  description: z
    .string()
    .trim()
    .min(3, 'description deve ter ao menos 3 caracteres.')
    .max(255, 'description deve ter no maximo 255 caracteres.'),
  date: isoDateTimeString('date'),
})

export const createFinancialClosureSchema = z.object({
  entries: z
    .array(financeEntryRefSchema)
    .min(1, 'A baixa financeira deve conter ao menos uma entrada.'),
  closedAt: isoDateTimeString('closedAt'),
})

export const createSaleSchema = z
  .object({
    items: z.array(orderItemSchema).min(1, 'A venda deve ter ao menos um item.'),
    paymentMethod: z.enum(['CASH', 'CARD', 'PIX']).optional(),
    payment: z
      .object({
        method: z.enum(['CASH', 'CARD', 'PIX']).optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough()

export const updateSaleStatusSchema = z.object({
  status: z.enum(['POSTED', 'CANCELLED', 'REVERSED'], 'status de venda invalido.'),
})

export const ifoodPollingSchema = z.object({
  storeId: nonEmptyString('storeId'),
  merchantId: nonEmptyString('merchantId'),
})

export const ifoodOrderSyncParamsSchema = z.object({
  storeId: nonEmptyString('storeId'),
  merchantId: nonEmptyString('merchantId'),
  orderId: nonEmptyString('orderId'),
})

export const ifoodWebhookSchema = z.object({
  signature: nonEmptyString('signature'),
  body: z.string().min(1, 'body do webhook e obrigatorio.'),
})

export const adminAuditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'page deve ser maior que zero.').default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'limit deve ser maior que zero.')
    .max(200, 'limit deve ser no maximo 200.')
    .default(50),
  actor: z
    .string()
    .trim()
    .max(120, 'actor deve ter no maximo 120 caracteres.')
    .optional()
    .default(''),
  user: z
    .string()
    .trim()
    .max(120, 'user deve ter no maximo 120 caracteres.')
    .optional()
    .default(''),
  action: z
    .string()
    .trim()
    .max(80, 'action deve ter no maximo 80 caracteres.')
    .optional()
    .default(''),
  resource: z
    .string()
    .trim()
    .max(120, 'resource deve ter no maximo 120 caracteres.')
    .optional()
    .default(''),
  module: z
    .string()
    .trim()
    .max(120, 'module deve ter no maximo 120 caracteres.')
    .optional()
    .default(''),
  entity: z
    .string()
    .trim()
    .max(120, 'entity deve ter no maximo 120 caracteres.')
    .optional()
    .default(''),
  search: z
    .string()
    .trim()
    .max(200, 'search deve ter no maximo 200 caracteres.')
    .optional()
    .default(''),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date deve estar no formato YYYY-MM-DD.')
    .optional()
    .default(''),
})

const zeDeliveryLocationSchema = z
  .object({
    address: z.string().trim().max(255, 'location.address deve ter no maximo 255 caracteres.'),
    lat: z.coerce.number().min(-90).max(90).nullable().optional().default(null),
    lng: z.coerce.number().min(-180).max(180).nullable().optional().default(null),
  })
  .partial()
  .default({})

export const zeDeliveryOrderSchema = z.object({
  zeDeliveryId: nonEmptyString('zeDeliveryId'),
  code: nonEmptyString('code'),
  status: nonEmptyString('status'),
  timestamp: isoDateTimeString('timestamp'),
  location: zeDeliveryLocationSchema.optional().default({}),
  scannedBy: z.string().trim().max(120, 'scannedBy deve ter no maximo 120 caracteres.').optional(),
  courierName: z
    .string()
    .trim()
    .max(120, 'courierName deve ter no maximo 120 caracteres.')
    .optional(),
  rawStatus: z.string().trim().max(120, 'rawStatus deve ter no maximo 120 caracteres.').optional(),
  originalData: z.record(z.string(), z.unknown()).optional().default({}),
})

export const zeDeliveryIngestSchema = z.object({
  storeId: nonEmptyString('storeId'),
  dryRun: z.coerce.boolean().optional().default(false),
  deliveries: z.array(zeDeliveryOrderSchema).min(1, 'Informe ao menos uma entrega.').max(200),
  syncMetadata: z
    .object({
      runId: z.string().trim().max(120).optional(),
      trigger: z.string().trim().max(40).optional(),
      scrapedAt: isoDateTimeString('syncMetadata.scrapedAt').optional(),
      source: z.string().trim().max(40).optional(),
    })
    .partial()
    .optional()
    .default({}),
})

export const zeDeliveryManualSyncSchema = z.object({
  storeId: nonEmptyString('storeId'),
  dryRun: z.coerce.boolean().optional().default(false),
  maxOrders: z.coerce.number().int().min(1).max(200).optional().default(50),
})

export const zeDeliveryStatusQuerySchema = z.object({
  storeId: z.string().trim().min(1).optional().default(''),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const zeDeliveryRetryParamsSchema = z.object({
  storeId: nonEmptyString('storeId'),
  zeDeliveryId: nonEmptyString('zeDeliveryId'),
})

const zeDeliveryIntervalSchema = z.union([
  z.literal(5),
  z.literal(10),
  z.literal(15),
  z.literal(30),
])

export const zeDeliverySettingsQuerySchema = z.object({
  storeId: nonEmptyString('storeId'),
})

export const zeDeliverySettingsUpdateSchema = z.object({
  storeId: nonEmptyString('storeId'),
  enabled: z.coerce.boolean(),
  intervalMinutes: z.coerce.number().int().pipe(zeDeliveryIntervalSchema),
  notificationsEnabled: z.coerce.boolean().optional().default(false),
  notificationWebhookUrl: z
    .union([
      z.literal(''),
      z.string().trim().url('notificationWebhookUrl deve ser uma URL valida.'),
    ])
    .optional()
    .default(''),
})

const reportTypeSchema = z.enum(['sales', 'cash', 'deliveries', 'operations', 'audit'])
const reportFormatSchema = z.enum(['pdf', 'excel'])
const analyticsModuleSchema = z.enum(['all', 'pdv', 'ifood', 'ze_delivery'])
const analyticsCompareSchema = z.enum(['previous_period', 'week', 'month', 'year'])

export const generateReportSchema = z.object({
  storeId: nonEmptyString('storeId'),
  type: reportTypeSchema,
  format: reportFormatSchema,
  startDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate deve estar no formato YYYY-MM-DD.'),
  endDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate deve estar no formato YYYY-MM-DD.'),
  operator: z.string().trim().max(120).optional().default(''),
  module: z.string().trim().max(120).optional().default(''),
  template: z.string().trim().max(80).optional().default('default'),
  scheduledFor: z.string().trim().datetime().optional().nullable().default(null),
})

export const reportHistoryQuerySchema = z.object({
  storeId: nonEmptyString('storeId'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const analyticsQuerySchema = z.object({
  storeId: nonEmptyString('storeId'),
  startDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate deve estar no formato YYYY-MM-DD.'),
  endDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate deve estar no formato YYYY-MM-DD.'),
  module: analyticsModuleSchema.optional().default('all'),
  compareBy: analyticsCompareSchema.optional().default('previous_period'),
})

export {
  financeEntryRefSchema,
  isoDateTimeString,
  merchantSchema,
  orderItemSchema,
  orderStatusSchema,
  authLoginSchema as loginSchema,
}
