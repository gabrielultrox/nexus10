import { z } from 'zod'

export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Nome deve ter no minimo 3 caracteres.')
    .max(100, 'Nome deve ter no maximo 100 caracteres.'),
  description: z
    .string()
    .trim()
    .max(500, 'Descricao deve ter no maximo 500 caracteres.')
    .optional(),
  price: z.number().positive('Preco deve ser positivo.'),
  cost: z.number().positive('Custo deve ser positivo.').optional(),
  category: z.string().trim().min(1, 'Categoria e obrigatoria.'),
  stock: z
    .number()
    .int('Estoque deve ser inteiro.')
    .min(0, 'Estoque nao pode ser negativo.')
    .default(0),
  sku: z
    .string()
    .trim()
    .min(1, 'SKU e obrigatorio.')
    .max(50, 'SKU deve ter no maximo 50 caracteres.'),
  active: z.boolean().default(true),
})

export const updateProductSchema = createProductSchema.partial()

export const validateStockSchema = z.object({
  productId: z.string().uuid('Produto deve ser um UUID valido.'),
  requiredQuantity: z.number().positive('Quantidade requerida deve ser positiva.'),
})

export type ICreateProductInput = z.infer<typeof createProductSchema>
export type IUpdateProductInput = z.infer<typeof updateProductSchema>
export type IValidateStockInput = z.infer<typeof validateStockSchema>
