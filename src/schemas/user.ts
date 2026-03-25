import { z } from 'zod'

import { UserRole } from '@/types'

export const loginSchema = z.object({
  pin: z
    .string()
    .min(4, 'PIN deve ter no minimo 4 digitos.')
    .max(6, 'PIN deve ter no maximo 6 digitos.')
    .regex(/^\d+$/, 'PIN deve conter apenas numeros.'),
  deviceId: z.string().trim().optional(),
})

export const createUserSchema = z.object({
  name: z.string().trim().min(3, 'Nome deve ter no minimo 3 caracteres.').max(100, 'Nome deve ter no maximo 100 caracteres.'),
  email: z.string().trim().email('Informe um e-mail valido.'),
  role: z.nativeEnum(UserRole),
  pin: z
    .string()
    .min(4, 'PIN deve ter no minimo 4 digitos.')
    .max(6, 'PIN deve ter no maximo 6 digitos.')
    .regex(/^\d+$/, 'PIN deve conter apenas numeros.'),
  active: z.boolean().default(true),
})

export const updateUserSchema = createUserSchema.partial()

export type ILoginInput = z.infer<typeof loginSchema>
export type ICreateUserInput = z.infer<typeof createUserSchema>
export type IUpdateUserInput = z.infer<typeof updateUserSchema>
