import { z } from 'zod';

const nonEmptyString = (label) => z.string().trim().min(1, `${label} e obrigatorio.`);

const orderItemSchema = z.object({
  id: z.string().trim().optional(),
  productId: z.string().trim().min(1, 'productId e obrigatorio.'),
  quantity: z.coerce.number().int().positive('quantity deve ser maior que zero.'),
  price: z.coerce.number().positive('price deve ser maior que zero.').optional(),
  unitPrice: z.coerce.number().positive('unitPrice deve ser maior que zero.').optional(),
}).superRefine((value, context) => {
  if (value.price == null && value.unitPrice == null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe price ou unitPrice no item.',
      path: ['price'],
    });
  }
});

export const loginSchema = z.object({
  pin: z.string().trim().regex(/^\d{4,6}$/, 'PIN deve conter entre 4 e 6 digitos.').optional(),
  password: z.string().trim().regex(/^\d{4,6}$/, 'PIN deve conter entre 4 e 6 digitos.').optional(),
  operator: nonEmptyString('operator').optional(),
  operatorName: nonEmptyString('operator').optional(),
  storeId: z.string().trim().min(1, 'storeId e obrigatorio.').optional(),
}).superRefine((value, context) => {
  if (!value.pin && !value.password) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'PIN e obrigatorio.',
      path: ['pin'],
    });
  }

  if (!value.operator && !value.operatorName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'operator e obrigatorio.',
      path: ['operator'],
    });
  }
}).transform((value) => ({
  pin: value.pin ?? value.password,
  operator: value.operator ?? value.operatorName,
  storeId: value.storeId ?? null,
}));

export const createOrderSchema = z.object({
  orderId: z.string().trim().min(1, 'orderId e obrigatorio.').optional(),
  code: z.string().trim().min(1, 'orderId e obrigatorio.').optional(),
  merchant: z.union([
    z.string().trim().min(1, 'merchant e obrigatorio.'),
    z.object({
      id: z.string().trim().min(1).optional(),
      name: z.string().trim().min(1).optional(),
    }).passthrough(),
  ]).optional(),
  source: z.string().trim().min(1, 'merchant e obrigatorio.').optional(),
  items: z.array(orderItemSchema).min(1, 'A ordem deve ter ao menos um item.'),
}).superRefine((value, context) => {
  if (!value.orderId && !value.code) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'orderId e obrigatorio.',
      path: ['orderId'],
    });
  }

  if (!value.merchant && !value.source) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'merchant e obrigatorio.',
      path: ['merchant'],
    });
  }
}).transform((value) => ({
  orderId: value.orderId ?? value.code,
  merchant: value.merchant ?? value.source,
  items: value.items,
  raw: value,
}));

export const createFinancialTransactionSchema = z.object({
  amount: z.coerce.number().positive('amount deve ser maior que zero.'),
  description: z.string().trim().min(3, 'description deve ter ao menos 3 caracteres.').max(255, 'description deve ter no maximo 255 caracteres.'),
  date: z.string().trim().datetime('date deve estar em formato ISO valido.'),
});

export const createSaleSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'A venda deve ter ao menos um item.'),
  paymentMethod: z.enum(['CASH', 'CARD', 'PIX']).optional(),
  payment: z.object({
    method: z.enum(['CASH', 'CARD', 'PIX']).optional(),
  }).partial().optional(),
}).passthrough();

export const updateSaleStatusSchema = z.object({
  status: z.enum(['POSTED', 'CANCELLED', 'REVERSED'], 'status de venda invalido.'),
});

export const ifoodPollingSchema = z.object({
  storeId: z.string().trim().min(1, 'storeId e obrigatorio.'),
  merchantId: z.string().trim().min(1, 'merchantId e obrigatorio.'),
});

export const ifoodOrderSyncParamsSchema = z.object({
  storeId: z.string().trim().min(1, 'storeId e obrigatorio.'),
  merchantId: z.string().trim().min(1, 'merchantId e obrigatorio.'),
  orderId: z.string().trim().min(1, 'orderId e obrigatorio.'),
});

export const ifoodWebhookSchema = z.object({
  signature: z.string().trim().min(1, 'signature e obrigatoria.'),
  body: z.string().min(1, 'body do webhook e obrigatorio.'),
});
