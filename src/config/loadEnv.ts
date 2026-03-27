import { clientEnvSchema, deprecatedClientVariables, type ClientEnv } from './env.schema'

let clientEnvCache: ClientEnv | null = null

function formatIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues
    .map((issue) => {
      const field =
        issue.path.length > 0 ? issue.path.map((segment) => String(segment)).join('.') : 'root'
      return `${field}: ${issue.message}`
    })
    .join('\n')
}

function normalizeClientEnv(rawEnv: ImportMetaEnv) {
  return {
    ...rawEnv,
    VITE_APP_ENV: rawEnv.VITE_APP_ENV ?? 'development',
    VITE_API_BASE_URL: rawEnv.VITE_API_BASE_URL ?? rawEnv.VITE_API_URL ?? '/api',
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

export function loadClientEnv(rawEnv: ImportMetaEnv = import.meta.env) {
  if (clientEnvCache) {
    return clientEnvCache
  }

  warnDeprecatedClientEnv(rawEnv)

  const parsed = clientEnvSchema.safeParse(normalizeClientEnv(rawEnv))

  if (!parsed.success) {
    throw new Error(
      `Falha ao validar variaveis de ambiente do frontend.\n${formatIssues(parsed.error)}`,
    )
  }

  clientEnvCache = parsed.data
  return clientEnvCache
}

export function ensureClientEnvLoaded() {
  return loadClientEnv()
}
