import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { z } from 'zod'

import type { BackendEnvironment, RuntimeEnvironment } from '../types/index.js'

const runtimeEnvironmentSchema = z.enum(['development', 'staging', 'production', 'test'])
const logLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error'])

const deprecatedBackendVariables = [
  {
    key: 'VITE_API_URL',
    replacement: 'VITE_API_BASE_URL',
    reason: 'Use a base URL dedicada para o frontend.',
  },
] as const

let backendEnvCache: BackendEnvironment | null = null

function normalizeRuntimeEnvironment(
  value: unknown,
  fallback: RuntimeEnvironment = 'development',
): RuntimeEnvironment | string {
  if (value == null || value === '') {
    return fallback
  }

  const normalized = String(value).trim().toLowerCase()
  const aliases: Record<string, RuntimeEnvironment> = {
    dev: 'development',
    development: 'development',
    staging: 'staging',
    prod: 'production',
    production: 'production',
    test: 'test',
  }

  return aliases[normalized] ?? normalized
}

function loadEnvFiles(): void {
  const rootDirectory = process.cwd()
  const inferredEnvironment = normalizeRuntimeEnvironment(
    process.env.APP_ENV ?? process.env.VITE_APP_ENV ?? process.env.NODE_ENV ?? process.env.MODE,
    process.env.VITEST ? 'test' : 'development',
  )
  const appEnvironment = runtimeEnvironmentSchema.catch('development').parse(inferredEnvironment)

  const candidateFiles = [
    `.env.${appEnvironment}.local`,
    '.env.local',
    `.env.${appEnvironment}`,
    '.env',
  ]

  candidateFiles.forEach((fileName) => {
    const filePath = path.resolve(rootDirectory, fileName)

    if (fs.existsSync(filePath)) {
      dotenv.config({
        path: filePath,
        override: false,
      })
    }
  })
}

function asOptionalString(value: unknown): string | undefined {
  if (value == null) {
    return undefined
  }

  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : undefined
}

function createNumericSchema(defaultValue: number) {
  return z.preprocess((value) => {
    if (value == null || value === '') {
      return defaultValue
    }

    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }, z.number().finite())
}

function normalizeTrustProxyValue(value: unknown): boolean | number | string | string[] {
  if (value == null || value === '') {
    return ['loopback', 'linklocal', 'uniquelocal']
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const normalized = String(value).trim()
  const lowered = normalized.toLowerCase()

  if (['false', '0', 'off', 'no'].includes(lowered)) {
    return false
  }

  if (['true', '1', 'on', 'yes'].includes(lowered)) {
    return true
  }

  const numeric = Number(normalized)

  if (Number.isInteger(numeric) && numeric >= 0) {
    return numeric
  }

  const segments = normalized
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (segments.length > 1) {
    return segments
  }

  return segments[0] ?? normalized
}

const booleanStringSchema = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value
  }

  if (value == null || value === '') {
    return false
  }

  const normalized = String(value).trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}, z.boolean())

function createRequiredStringSchema(key: string) {
  return z.string().trim().min(1, `${key} e obrigatoria.`)
}

function warnDeprecatedBackendVariables(rawEnv: NodeJS.ProcessEnv): void {
  deprecatedBackendVariables.forEach(({ key, replacement, reason }) => {
    if (rawEnv[key]) {
      console.warn(
        `[env] Variavel deprecada detectada: ${key}. Use ${replacement}. ${reason ?? ''}`.trim(),
      )
    }
  })
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const field = issue.path.length > 0 ? issue.path.join('.') : 'root'
      return `- ${field}: ${issue.message}`
    })
    .join('\n')
}

function buildRawBackendEnv(): NodeJS.ProcessEnv {
  const rawEnv = { ...process.env }
  const effectiveEnvironment = runtimeEnvironmentSchema
    .catch('development')
    .parse(
      normalizeRuntimeEnvironment(
        rawEnv.APP_ENV ?? rawEnv.NODE_ENV ?? rawEnv.VITE_APP_ENV ?? rawEnv.MODE,
        process.env.VITEST ? 'test' : 'development',
      ),
    )

  rawEnv.APP_ENV = rawEnv.APP_ENV ?? effectiveEnvironment
  rawEnv.NODE_ENV = String(normalizeRuntimeEnvironment(rawEnv.NODE_ENV ?? effectiveEnvironment))
  rawEnv.SENTRY_RELEASE ??=
    rawEnv.VERCEL_GIT_COMMIT_SHA ??
    rawEnv.GITHUB_SHA ??
    rawEnv.RENDER_GIT_COMMIT ??
    rawEnv.npm_package_version ??
    'development'

  if (effectiveEnvironment === 'test' || process.env.VITEST) {
    rawEnv.FIREBASE_ADMIN_PROJECT_ID ??= 'test-project'
    rawEnv.FIREBASE_ADMIN_CLIENT_EMAIL ??= 'firebase-adminsdk@test-project.iam.gserviceaccount.com'
    rawEnv.FIREBASE_ADMIN_PRIVATE_KEY ??=
      '-----BEGIN PRIVATE KEY-----\\nTEST\\n-----END PRIVATE KEY-----\\n'
    rawEnv.IFOOD_WEBHOOK_SECRET ??= 'test-ifood-webhook-secret'
    rawEnv.LOCAL_OPERATOR_PASSWORD ??= 'test-local-operator-password'
    rawEnv.FRONTEND_ORIGIN ??= 'http://localhost:5173'
  }

  return rawEnv
}

const backendEnvSchema = z
  .object({
    APP_ENV: z.preprocess(
      (value) => normalizeRuntimeEnvironment(value, 'development'),
      runtimeEnvironmentSchema.default('development'),
    ),
    NODE_ENV: z.preprocess(
      (value) => normalizeRuntimeEnvironment(value, 'development'),
      runtimeEnvironmentSchema.default('development'),
    ),
    PORT: createNumericSchema(3001),
    TRUST_PROXY: z.preprocess(
      (value) => normalizeTrustProxyValue(value),
      z.union([
        z.boolean(),
        z.number().int().nonnegative(),
        z.string().trim().min(1),
        z.array(z.string().trim().min(1)).min(1),
      ]),
    ),
    LOG_LEVEL: z.preprocess(
      (value) => (value == null || value === '' ? 'info' : String(value).trim().toLowerCase()),
      logLevelSchema,
    ),
    SENTRY_DSN: z.string().trim().default(''),
    SENTRY_RELEASE: z.string().trim().default(''),
    SENTRY_TRACES_SAMPLE_RATE: createNumericSchema(0.2),
    MONITORING_WINDOW_MS: createNumericSchema(15 * 60 * 1000),
    ALERT_COOLDOWN_MS: createNumericSchema(10 * 60 * 1000),
    ALERT_DISCORD_WEBHOOK_URL: z.string().trim().default(''),
    ALERT_ERROR_RATE_THRESHOLD_PERCENT: createNumericSchema(5),
    ALERT_LATENCY_P95_THRESHOLD_MS: createNumericSchema(1000),
    ALERT_IFOOD_WEBHOOK_FAILURE_THRESHOLD: createNumericSchema(3),
    LOCAL_OPERATOR_PASSWORD: z.string().trim().optional(),
    REDIS_URL: z.string().trim().default(''),
    REDIS_KEY_PREFIX: z.string().trim().default('nexus10'),
    REDIS_SOCKET_TIMEOUT_MS: createNumericSchema(5000),
    REDIS_SESSION_TTL_SECONDS: createNumericSchema(300),
    REDIS_MERCHANT_TTL_SECONDS: createNumericSchema(180),
    REDIS_PRODUCT_TTL_SECONDS: createNumericSchema(120),
    OPENAI_API_KEY: z.string().trim().optional(),
    FRONTEND_ORIGIN: z.string().trim().optional(),
    CORS_PREFLIGHT_MAX_AGE_SECONDS: createNumericSchema(600),
    SECURITY_USER_AGENT_BLOCKLIST: z.string().trim().default(''),
    RATE_LIMIT_TRUSTED_IPS: z.string().trim().default(''),
    API_RATE_LIMIT_WINDOW_MS: createNumericSchema(60000),
    API_RATE_LIMIT_MAX: createNumericSchema(100),
    AUTH_RATE_LIMIT_MAX: createNumericSchema(20),
    IFOOD_ENABLED: booleanStringSchema.default(false),
    IFOOD_CLIENT_ID: z.string().trim().optional(),
    IFOOD_CLIENT_SECRET: z.string().trim().optional(),
    IFOOD_AUTH_BASE_URL: z
      .string()
      .trim()
      .default('https://merchant-api.ifood.com.br/authentication/v1.0'),
    IFOOD_MERCHANT_BASE_URL: z.string().trim().default('https://merchant-api.ifood.com.br'),
    IFOOD_EVENTS_POLLING_PATH: z.string().trim().default('/events/v1.0/events:polling'),
    IFOOD_EVENTS_ACK_PATH: z.string().trim().default('/events/v1.0/events/acknowledgment'),
    IFOOD_ORDER_DETAILS_PATH: z.string().trim().default('/order/v1.0/orders'),
    IFOOD_WEBHOOK_URL: z.string().trim().default(''),
    IFOOD_WEBHOOK_SECRET: z.string().trim().default(''),
    IFOOD_POLLING_INTERVAL_SECONDS: createNumericSchema(30),
    FIREBASE_ADMIN_PROJECT_ID: z.string().trim().default(''),
    FIREBASE_ADMIN_CLIENT_EMAIL: z.string().trim().default(''),
    FIREBASE_ADMIN_PRIVATE_KEY: z.string().trim().default(''),
    FIREBASE_STORAGE_BUCKET: z.string().trim().optional(),
    FIRESTORE_EMULATOR_HOST: z.string().trim().optional(),
    FIREBASE_AUTH_EMULATOR_HOST: z.string().trim().optional(),
    VITE_FIREBASE_PROJECT_ID: z.string().trim().optional(),
    VITE_FIREBASE_STORAGE_BUCKET: z.string().trim().optional(),
  })
  .superRefine((data, context) => {
    if (data.APP_ENV === 'production' && !asOptionalString(data.FRONTEND_ORIGIN)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FRONTEND_ORIGIN'],
        message: 'e obrigatoria em producao.',
      })
    }

    if (data.APP_ENV === 'production' && !asOptionalString(data.LOCAL_OPERATOR_PASSWORD)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['LOCAL_OPERATOR_PASSWORD'],
        message: 'e obrigatoria em producao.',
      })
    }

    if (data.IFOOD_ENABLED && !asOptionalString(data.IFOOD_CLIENT_ID)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['IFOOD_CLIENT_ID'],
        message: 'e obrigatoria quando IFOOD_ENABLED=true.',
      })
    }

    if (data.IFOOD_ENABLED && !asOptionalString(data.IFOOD_CLIENT_SECRET)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['IFOOD_CLIENT_SECRET'],
        message: 'e obrigatoria quando IFOOD_ENABLED=true.',
      })
    }

    if (data.IFOOD_ENABLED && !asOptionalString(data.IFOOD_WEBHOOK_SECRET)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['IFOOD_WEBHOOK_SECRET'],
        message: 'e obrigatoria quando IFOOD_ENABLED=true.',
      })
    }

    if (data.APP_ENV === 'production' && !asOptionalString(data.FIREBASE_ADMIN_PROJECT_ID)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FIREBASE_ADMIN_PROJECT_ID'],
        message: 'e obrigatoria em producao.',
      })
    }

    if (data.APP_ENV === 'production' && !asOptionalString(data.FIREBASE_ADMIN_CLIENT_EMAIL)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FIREBASE_ADMIN_CLIENT_EMAIL'],
        message: 'e obrigatoria em producao.',
      })
    }

    if (data.APP_ENV === 'production' && !asOptionalString(data.FIREBASE_ADMIN_PRIVATE_KEY)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FIREBASE_ADMIN_PRIVATE_KEY'],
        message: 'e obrigatoria em producao.',
      })
    }
  })

type RawBackendEnvironment = z.infer<typeof backendEnvSchema>

function normalizeBackendEnv(parsedEnv: RawBackendEnvironment): BackendEnvironment {
  return {
    port: parsedEnv.PORT,
    nodeEnv: parsedEnv.NODE_ENV,
    appEnv: parsedEnv.APP_ENV,
    trustProxy: parsedEnv.TRUST_PROXY,
    logLevel: parsedEnv.LOG_LEVEL,
    sentryDsn: parsedEnv.SENTRY_DSN,
    sentryRelease: parsedEnv.SENTRY_RELEASE,
    sentryTracesSampleRate: parsedEnv.SENTRY_TRACES_SAMPLE_RATE,
    monitoringWindowMs: parsedEnv.MONITORING_WINDOW_MS,
    alertCooldownMs: parsedEnv.ALERT_COOLDOWN_MS,
    alertDiscordWebhookUrl: parsedEnv.ALERT_DISCORD_WEBHOOK_URL,
    alertErrorRateThresholdPercent: parsedEnv.ALERT_ERROR_RATE_THRESHOLD_PERCENT,
    alertLatencyP95ThresholdMs: parsedEnv.ALERT_LATENCY_P95_THRESHOLD_MS,
    alertIfoodWebhookFailureThreshold: parsedEnv.ALERT_IFOOD_WEBHOOK_FAILURE_THRESHOLD,
    localOperatorPassword: parsedEnv.LOCAL_OPERATOR_PASSWORD || '01',
    redisUrl: parsedEnv.REDIS_URL,
    redisKeyPrefix: parsedEnv.REDIS_KEY_PREFIX,
    redisSocketTimeoutMs: parsedEnv.REDIS_SOCKET_TIMEOUT_MS,
    redisSessionTtlSeconds: parsedEnv.REDIS_SESSION_TTL_SECONDS,
    redisMerchantTtlSeconds: parsedEnv.REDIS_MERCHANT_TTL_SECONDS,
    redisProductTtlSeconds: parsedEnv.REDIS_PRODUCT_TTL_SECONDS,
    openaiApiKey: asOptionalString(parsedEnv.OPENAI_API_KEY) ?? null,
    frontendOrigin: (parsedEnv.FRONTEND_ORIGIN ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    corsPreflightMaxAgeSeconds: parsedEnv.CORS_PREFLIGHT_MAX_AGE_SECONDS,
    securityUserAgentBlocklist: parsedEnv.SECURITY_USER_AGENT_BLOCKLIST.split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    rateLimitTrustedIps: parsedEnv.RATE_LIMIT_TRUSTED_IPS.split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    apiRateLimitWindowMs: parsedEnv.API_RATE_LIMIT_WINDOW_MS,
    apiRateLimitMax: parsedEnv.API_RATE_LIMIT_MAX,
    authRateLimitMax: parsedEnv.AUTH_RATE_LIMIT_MAX,
    ifoodEnabled: parsedEnv.IFOOD_ENABLED,
    ifoodClientId: asOptionalString(parsedEnv.IFOOD_CLIENT_ID) ?? '',
    ifoodClientSecret: asOptionalString(parsedEnv.IFOOD_CLIENT_SECRET) ?? '',
    ifoodAuthBaseUrl: parsedEnv.IFOOD_AUTH_BASE_URL,
    ifoodMerchantBaseUrl: parsedEnv.IFOOD_MERCHANT_BASE_URL,
    ifoodEventsPollingPath: parsedEnv.IFOOD_EVENTS_POLLING_PATH,
    ifoodEventsAckPath: parsedEnv.IFOOD_EVENTS_ACK_PATH,
    ifoodOrderDetailsPath: parsedEnv.IFOOD_ORDER_DETAILS_PATH,
    ifoodWebhookUrl: parsedEnv.IFOOD_WEBHOOK_URL,
    ifoodWebhookSecret: parsedEnv.IFOOD_WEBHOOK_SECRET,
    ifoodPollingIntervalSeconds: parsedEnv.IFOOD_POLLING_INTERVAL_SECONDS,
    firebaseProjectId:
      asOptionalString(parsedEnv.FIREBASE_ADMIN_PROJECT_ID) ??
      asOptionalString(parsedEnv.VITE_FIREBASE_PROJECT_ID) ??
      '',
    firebaseClientEmail: asOptionalString(parsedEnv.FIREBASE_ADMIN_CLIENT_EMAIL) ?? '',
    firebasePrivateKey: (asOptionalString(parsedEnv.FIREBASE_ADMIN_PRIVATE_KEY) ?? '').replace(
      /\\n/g,
      '\n',
    ),
    firebaseStorageBucket:
      asOptionalString(parsedEnv.FIREBASE_STORAGE_BUCKET) ??
      asOptionalString(parsedEnv.VITE_FIREBASE_STORAGE_BUCKET) ??
      `${asOptionalString(parsedEnv.FIREBASE_ADMIN_PROJECT_ID) ?? asOptionalString(parsedEnv.VITE_FIREBASE_PROJECT_ID) ?? ''}.firebasestorage.app`,
    firestoreEmulatorHost: asOptionalString(parsedEnv.FIRESTORE_EMULATOR_HOST) ?? '',
    firebaseAuthEmulatorHost: asOptionalString(parsedEnv.FIREBASE_AUTH_EMULATOR_HOST) ?? '',
  }
}

export function loadBackendEnv(): BackendEnvironment {
  if (backendEnvCache) {
    return backendEnvCache
  }

  loadEnvFiles()
  warnDeprecatedBackendVariables(process.env)

  const rawEnv = buildRawBackendEnv()
  const result = backendEnvSchema.safeParse(rawEnv)

  if (!result.success) {
    throw new Error(
      `Falha ao validar variaveis de ambiente do backend.\n${formatZodIssues(result.error)}`,
    )
  }

  backendEnvCache = normalizeBackendEnv(result.data)
  return backendEnvCache
}

export function ensureBackendEnvLoaded(): BackendEnvironment {
  return loadBackendEnv()
}

export const backendEnv: BackendEnvironment = loadBackendEnv()

export function hasFirebaseAdminConfig(): boolean {
  return Boolean(
    backendEnv.firebaseProjectId && backendEnv.firebaseClientEmail && backendEnv.firebasePrivateKey,
  )
}
