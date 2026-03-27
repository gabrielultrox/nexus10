import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { z } from 'zod'

const appEnvironmentSchema = z.enum(['development', 'staging', 'production', 'test'])

const deprecatedBackendVariables = [
  {
    key: 'VITE_API_URL',
    replacement: 'VITE_API_BASE_URL',
    reason: 'Use a base URL dedicada para o frontend.',
  },
]

let backendEnvCache = null

function loadEnvFiles() {
  const rootDirectory = process.cwd()
  const inferredEnvironment =
    process.env.APP_ENV ?? process.env.VITE_APP_ENV ?? process.env.NODE_ENV ?? 'development'
  const appEnvironment = appEnvironmentSchema.catch('development').parse(inferredEnvironment)

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

function asOptionalString(value) {
  if (value == null) {
    return undefined
  }

  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : undefined
}

function createNumericSchema(defaultValue) {
  return z.preprocess((value) => {
    if (value == null || value === '') {
      return defaultValue
    }

    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }, z.number().finite())
}

function warnDeprecatedBackendVariables(rawEnv) {
  deprecatedBackendVariables.forEach(({ key, replacement, reason }) => {
    if (rawEnv[key]) {
      console.warn(
        `[env] Variavel deprecada detectada: ${key}. Use ${replacement}. ${reason ?? ''}`.trim(),
      )
    }
  })
}

function formatZodIssues(error) {
  return error.issues
    .map((issue) => {
      const field = issue.path.length > 0 ? issue.path.join('.') : 'root'
      return `${field}: ${issue.message}`
    })
    .join('\n')
}

const backendEnvSchema = z
  .object({
    APP_ENV: appEnvironmentSchema.default('development'),
    NODE_ENV: z.string().trim().optional(),
    PORT: createNumericSchema(8787),
    LOG_LEVEL: z.string().trim().default('info'),
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
    FRONTEND_ORIGIN: z.string().trim().default(''),
    API_RATE_LIMIT_WINDOW_MS: createNumericSchema(15 * 60 * 1000),
    API_RATE_LIMIT_MAX: createNumericSchema(300),
    AUTH_RATE_LIMIT_MAX: createNumericSchema(20),
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
    FIREBASE_ADMIN_PROJECT_ID: z.string().trim().optional().or(z.literal('')),
    FIREBASE_ADMIN_CLIENT_EMAIL: z.string().trim().optional().or(z.literal('')),
    FIREBASE_ADMIN_PRIVATE_KEY: z.string().trim().optional().or(z.literal('')),
    FIRESTORE_EMULATOR_HOST: z.string().trim().optional(),
    FIREBASE_AUTH_EMULATOR_HOST: z.string().trim().optional(),
    VITE_FIREBASE_PROJECT_ID: z.string().trim().optional(),
  })
  .superRefine((data, context) => {
    if (['staging', 'production'].includes(data.APP_ENV) && !data.LOCAL_OPERATOR_PASSWORD) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['LOCAL_OPERATOR_PASSWORD'],
        message: 'obrigatoria em staging/producao.',
      })
    }
  })

function normalizeBackendEnv(parsedEnv) {
  return {
    port: parsedEnv.PORT,
    nodeEnv: parsedEnv.NODE_ENV?.trim() || parsedEnv.APP_ENV,
    appEnv: parsedEnv.APP_ENV,
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
    localOperatorPassword:
      parsedEnv.LOCAL_OPERATOR_PASSWORD || (parsedEnv.APP_ENV === 'production' ? '' : '01'),
    redisUrl: parsedEnv.REDIS_URL,
    redisKeyPrefix: parsedEnv.REDIS_KEY_PREFIX,
    redisSocketTimeoutMs: parsedEnv.REDIS_SOCKET_TIMEOUT_MS,
    redisSessionTtlSeconds: parsedEnv.REDIS_SESSION_TTL_SECONDS,
    redisMerchantTtlSeconds: parsedEnv.REDIS_MERCHANT_TTL_SECONDS,
    redisProductTtlSeconds: parsedEnv.REDIS_PRODUCT_TTL_SECONDS,
    openaiApiKey: asOptionalString(parsedEnv.OPENAI_API_KEY) ?? null,
    frontendOrigin: parsedEnv.FRONTEND_ORIGIN.split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    apiRateLimitWindowMs: parsedEnv.API_RATE_LIMIT_WINDOW_MS,
    apiRateLimitMax: parsedEnv.API_RATE_LIMIT_MAX,
    authRateLimitMax: parsedEnv.AUTH_RATE_LIMIT_MAX,
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
    firestoreEmulatorHost: asOptionalString(parsedEnv.FIRESTORE_EMULATOR_HOST) ?? '',
    firebaseAuthEmulatorHost: asOptionalString(parsedEnv.FIREBASE_AUTH_EMULATOR_HOST) ?? '',
  }
}

export function loadBackendEnv() {
  if (backendEnvCache) {
    return backendEnvCache
  }

  loadEnvFiles()
  warnDeprecatedBackendVariables(process.env)

  const result = backendEnvSchema.safeParse(process.env)

  if (!result.success) {
    throw new Error(
      `Falha ao validar variaveis de ambiente do backend.\n${formatZodIssues(result.error)}`,
    )
  }

  backendEnvCache = normalizeBackendEnv(result.data)
  return backendEnvCache
}

export function ensureBackendEnvLoaded() {
  return loadBackendEnv()
}

export const backendEnv = loadBackendEnv()

export function hasFirebaseAdminConfig() {
  return Boolean(
    backendEnv.firebaseProjectId && backendEnv.firebaseClientEmail && backendEnv.firebasePrivateKey,
  )
}
