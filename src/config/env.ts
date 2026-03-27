import { z } from 'zod'

const frontendEnvironmentSchema = z.enum(['development', 'staging', 'production', 'test'])
const frontendLogLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error'])

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

function normalizeFrontendEnvironment(value: unknown) {
  if (value == null || value === '') {
    return 'development'
  }

  const normalized = String(value).trim().toLowerCase()
  const aliases: Record<string, string> = {
    dev: 'development',
    development: 'development',
    staging: 'staging',
    prod: 'production',
    production: 'production',
    test: 'test',
  }

  return aliases[normalized] ?? normalized
}

function formatIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues
    .map((issue) => {
      const field =
        issue.path.length > 0 ? issue.path.map((segment) => String(segment)).join('.') : 'root'
      return `- ${field}: ${issue.message}`
    })
    .join('\n')
}

function normalizeRawClientEnv(rawEnv: ImportMetaEnv) {
  return {
    ...rawEnv,
    VITE_APP_ENV: normalizeFrontendEnvironment(rawEnv.VITE_APP_ENV),
    VITE_API_BASE_URL: rawEnv.VITE_API_BASE_URL ?? rawEnv.VITE_API_URL ?? '',
    VITE_LOG_LEVEL: rawEnv.VITE_LOG_LEVEL ?? 'info',
    VITE_FIREBASE_USE_EMULATORS: rawEnv.VITE_FIREBASE_USE_EMULATORS ?? 'false',
    VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: rawEnv.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST ?? '',
    VITE_FIREBASE_AUTH_EMULATOR_HOST: rawEnv.VITE_FIREBASE_AUTH_EMULATOR_HOST ?? '',
  }
}

function warnDeprecatedClientEnv(rawEnv: ImportMetaEnv) {
  deprecatedClientVariables.forEach(({ key, replacement, reason }) => {
    if (rawEnv[key as keyof ImportMetaEnv]) {
      console.warn(
        `[env] Variavel deprecada detectada: ${key}. Use ${replacement}. ${reason ?? ''}`.trim(),
      )
    }
  })
}

export const clientEnvSchema = z.object({
  VITE_APP_ENV: frontendEnvironmentSchema.default('development'),
  VITE_FIREBASE_PROJECT_ID: z.string().trim().min(1, 'VITE_FIREBASE_PROJECT_ID e obrigatoria.'),
  VITE_FIREBASE_APP_ID: z.string().trim().min(1, 'VITE_FIREBASE_APP_ID e obrigatoria.'),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().trim().min(1, 'VITE_FIREBASE_AUTH_DOMAIN e obrigatoria.'),
  VITE_FIREBASE_API_KEY: z.string().trim().min(1, 'VITE_FIREBASE_API_KEY e obrigatoria.'),
  VITE_API_BASE_URL: z.string().trim().min(1, 'VITE_API_BASE_URL e obrigatoria.'),
  VITE_LOG_LEVEL: z.preprocess(
    (value) => (value == null || value === '' ? 'info' : String(value).trim().toLowerCase()),
    frontendLogLevelSchema,
  ),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().trim().default(''),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().trim().default(''),
  VITE_FIREBASE_USE_EMULATORS: booleanStringSchema.default(false),
  VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: z.string().trim().default(''),
  VITE_FIREBASE_AUTH_EMULATOR_HOST: z.string().trim().default(''),
})

let clientEnvCache: FrontendEnv | null = null

export function loadFrontendEnv(rawEnv: ImportMetaEnv = import.meta.env) {
  if (clientEnvCache) {
    return clientEnvCache
  }

  warnDeprecatedClientEnv(rawEnv)

  const parsed = clientEnvSchema.safeParse(normalizeRawClientEnv(rawEnv))

  if (!parsed.success) {
    throw new Error(
      `Falha ao validar variaveis de ambiente do frontend.\n${formatIssues(parsed.error)}`,
    )
  }

  clientEnvCache = parsed.data
  return clientEnvCache
}

export function ensureFrontendEnvLoaded() {
  return loadFrontendEnv()
}

export const loadClientEnv = loadFrontendEnv
export const ensureClientEnvLoaded = ensureFrontendEnvLoaded
export const clientEnv = loadFrontendEnv()

export type FrontendEnv = z.infer<typeof clientEnvSchema>
export type ClientEnv = FrontendEnv
export type FrontendLogLevel = z.infer<typeof frontendLogLevelSchema>
