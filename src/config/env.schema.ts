import { z } from 'zod'

export const appEnvironmentSchema = z.enum(['development', 'staging', 'production', 'test'])

export const deprecatedClientVariables = [
  {
    key: 'VITE_API_URL',
    replacement: 'VITE_API_BASE_URL',
    reason: 'Padronize a base URL da API em uma unica variavel.',
  },
] as const

const booleanStringSchema = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value
  }

  if (value == null || value === '') {
    return false
  }

  return String(value).toLowerCase() === 'true'
}, z.boolean())

export const clientEnvSchema = z.object({
  VITE_APP_ENV: appEnvironmentSchema.default('development'),
  VITE_API_BASE_URL: z.string().trim().min(1, 'VITE_API_BASE_URL e obrigatoria.'),
  VITE_FIREBASE_API_KEY: z.string().trim().min(1, 'VITE_FIREBASE_API_KEY e obrigatoria.'),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().trim().min(1, 'VITE_FIREBASE_AUTH_DOMAIN e obrigatoria.'),
  VITE_FIREBASE_PROJECT_ID: z.string().trim().min(1, 'VITE_FIREBASE_PROJECT_ID e obrigatoria.'),
  VITE_FIREBASE_STORAGE_BUCKET: z
    .string()
    .trim()
    .min(1, 'VITE_FIREBASE_STORAGE_BUCKET e obrigatoria.'),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z
    .string()
    .trim()
    .min(1, 'VITE_FIREBASE_MESSAGING_SENDER_ID e obrigatoria.'),
  VITE_FIREBASE_APP_ID: z.string().trim().min(1, 'VITE_FIREBASE_APP_ID e obrigatoria.'),
  VITE_FIREBASE_USE_EMULATORS: booleanStringSchema.default(false),
  VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: z.string().trim().default(''),
  VITE_FIREBASE_AUTH_EMULATOR_HOST: z.string().trim().default(''),
})

export type ClientEnv = z.infer<typeof clientEnvSchema>
