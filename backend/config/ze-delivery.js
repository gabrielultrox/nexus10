import fs from 'node:fs'
import path from 'node:path'

import { z } from 'zod'

import { ensureBackendEnvLoaded } from './env.js'

let zeDeliveryConfigCache = null

const booleanSchema = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value
  }

  if (value == null || value === '') {
    return false
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase())
}, z.boolean())

const numberSchema = (defaultValue) =>
  z.preprocess((value) => {
    if (value == null || value === '') {
      return defaultValue
    }

    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }, z.number().finite())

const zeDeliveryConfigSchema = z
  .object({
    ZE_DELIVERY_ENABLED: booleanSchema.default(false),
    ZE_DELIVERY_EMAIL: z.string().trim().optional(),
    ZE_DELIVERY_PASSWORD: z.string().trim().optional(),
    ZE_DELIVERY_LOGIN_URL: z.string().trim().optional(),
    ZE_DELIVERY_DASHBOARD_URL_TEMPLATE: z.string().trim().optional(),
    ZE_DELIVERY_STORE_IDS: z.string().trim().default(''),
    ZE_DELIVERY_SYNC_INTERVAL_MINUTES: numberSchema(10),
    ZE_DELIVERY_HEADLESS: booleanSchema.default(true),
    ZE_DELIVERY_DRY_RUN: booleanSchema.default(false),
    ZE_DELIVERY_NEXUS_API_BASE_URL: z.string().trim().default('http://127.0.0.1:8787'),
    ZE_DELIVERY_SYNC_TOKEN: z.string().trim().optional(),
    ZE_DELIVERY_SESSION_FILE: z.string().trim().default('tmp/ze-delivery-storage-state.json'),
    ZE_DELIVERY_TIMEOUT_MS: numberSchema(30000),
    ZE_DELIVERY_REQUEST_DELAY_MS: numberSchema(500),
    ZE_DELIVERY_MAX_ORDERS_PER_RUN: numberSchema(100),
    ZE_DELIVERY_RETRY_MAX: numberSchema(3),
    ZE_DELIVERY_RETRY_BASE_DELAY_MS: numberSchema(1000),
    ZE_DELIVERY_2FA_TIMEOUT_MS: numberSchema(120000),
    ZE_DELIVERY_BROWSER_CHANNEL: z.string().trim().default(''),
    ZE_DELIVERY_USER_AGENT: z.string().trim().default(''),
    ZE_DELIVERY_LOGIN_EMAIL_SELECTOR: z.string().trim().default('input[type="email"]'),
    ZE_DELIVERY_LOGIN_PASSWORD_SELECTOR: z.string().trim().default('input[type="password"]'),
    ZE_DELIVERY_LOGIN_SUBMIT_SELECTOR: z.string().trim().default('button[type="submit"]'),
    ZE_DELIVERY_AFTER_LOGIN_SELECTOR: z.string().trim().default('[data-testid="dashboard"]'),
    ZE_DELIVERY_2FA_SELECTOR: z.string().trim().default(''),
    ZE_DELIVERY_ORDER_ROW_SELECTOR: z.string().trim().default('[data-testid="delivery-row"]'),
    ZE_DELIVERY_ORDER_ID_SELECTOR: z.string().trim().default('[data-testid="delivery-id"]'),
    ZE_DELIVERY_CODE_SELECTOR: z.string().trim().default('[data-testid="delivery-code"]'),
    ZE_DELIVERY_STATUS_SELECTOR: z.string().trim().default('[data-testid="delivery-status"]'),
    ZE_DELIVERY_LOCATION_SELECTOR: z.string().trim().default('[data-testid="delivery-location"]'),
    ZE_DELIVERY_COURIER_SELECTOR: z.string().trim().default('[data-testid="delivery-courier"]'),
    ZE_DELIVERY_SCANNED_BY_SELECTOR: z
      .string()
      .trim()
      .default('[data-testid="delivery-scanned-by"]'),
    ZE_DELIVERY_TIMESTAMP_SELECTOR: z.string().trim().default('[data-testid="delivery-timestamp"]'),
    ZE_DELIVERY_LAT_SELECTOR: z.string().trim().default(''),
    ZE_DELIVERY_LNG_SELECTOR: z.string().trim().default(''),
  })
  .superRefine((data, context) => {
    if (!data.ZE_DELIVERY_ENABLED) {
      return
    }

    for (const key of [
      'ZE_DELIVERY_EMAIL',
      'ZE_DELIVERY_PASSWORD',
      'ZE_DELIVERY_LOGIN_URL',
      'ZE_DELIVERY_DASHBOARD_URL_TEMPLATE',
      'ZE_DELIVERY_SYNC_TOKEN',
    ]) {
      if (!String(data[key] ?? '').trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} e obrigatoria quando ZE_DELIVERY_ENABLED=true.`,
        })
      }
    }
  })

export function resetZeDeliveryConfigCache() {
  zeDeliveryConfigCache = null
}

export function getZeDeliveryConfig(env = process.env) {
  if (zeDeliveryConfigCache) {
    return zeDeliveryConfigCache
  }

  ensureBackendEnvLoaded()
  const parsed = zeDeliveryConfigSchema.parse(env)
  const sessionFilePath = path.resolve(process.cwd(), parsed.ZE_DELIVERY_SESSION_FILE)

  zeDeliveryConfigCache = {
    enabled: parsed.ZE_DELIVERY_ENABLED,
    credentials: {
      email: parsed.ZE_DELIVERY_EMAIL ?? '',
      password: parsed.ZE_DELIVERY_PASSWORD ?? '',
    },
    urls: {
      login: parsed.ZE_DELIVERY_LOGIN_URL ?? '',
      dashboardTemplate: parsed.ZE_DELIVERY_DASHBOARD_URL_TEMPLATE ?? '',
      nexusApiBaseUrl: parsed.ZE_DELIVERY_NEXUS_API_BASE_URL.replace(/\/+$/, ''),
    },
    stores: parsed.ZE_DELIVERY_STORE_IDS.split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    browser: {
      headless: parsed.ZE_DELIVERY_HEADLESS,
      channel: parsed.ZE_DELIVERY_BROWSER_CHANNEL || undefined,
      sessionFilePath,
      timeoutMs: parsed.ZE_DELIVERY_TIMEOUT_MS,
      userAgent: parsed.ZE_DELIVERY_USER_AGENT || undefined,
    },
    sync: {
      dryRun: parsed.ZE_DELIVERY_DRY_RUN,
      intervalMinutes: parsed.ZE_DELIVERY_SYNC_INTERVAL_MINUTES,
      maxOrdersPerRun: parsed.ZE_DELIVERY_MAX_ORDERS_PER_RUN,
      retryMax: parsed.ZE_DELIVERY_RETRY_MAX,
      retryBaseDelayMs: parsed.ZE_DELIVERY_RETRY_BASE_DELAY_MS,
      requestDelayMs: parsed.ZE_DELIVERY_REQUEST_DELAY_MS,
      token: parsed.ZE_DELIVERY_SYNC_TOKEN ?? '',
    },
    selectors: {
      loginEmail: parsed.ZE_DELIVERY_LOGIN_EMAIL_SELECTOR,
      loginPassword: parsed.ZE_DELIVERY_LOGIN_PASSWORD_SELECTOR,
      loginSubmit: parsed.ZE_DELIVERY_LOGIN_SUBMIT_SELECTOR,
      afterLogin: parsed.ZE_DELIVERY_AFTER_LOGIN_SELECTOR,
      twoFactor: parsed.ZE_DELIVERY_2FA_SELECTOR || null,
      orderRow: parsed.ZE_DELIVERY_ORDER_ROW_SELECTOR,
      orderId: parsed.ZE_DELIVERY_ORDER_ID_SELECTOR,
      code: parsed.ZE_DELIVERY_CODE_SELECTOR,
      status: parsed.ZE_DELIVERY_STATUS_SELECTOR,
      location: parsed.ZE_DELIVERY_LOCATION_SELECTOR,
      courier: parsed.ZE_DELIVERY_COURIER_SELECTOR,
      scannedBy: parsed.ZE_DELIVERY_SCANNED_BY_SELECTOR,
      timestamp: parsed.ZE_DELIVERY_TIMESTAMP_SELECTOR,
      lat: parsed.ZE_DELIVERY_LAT_SELECTOR || null,
      lng: parsed.ZE_DELIVERY_LNG_SELECTOR || null,
    },
    twoFactorTimeoutMs: parsed.ZE_DELIVERY_2FA_TIMEOUT_MS,
  }

  return zeDeliveryConfigCache
}

export function isZeDeliveryEnabled(env = process.env) {
  return getZeDeliveryConfig(env).enabled
}

export function buildZeDeliveryDashboardUrl(storeId, config = getZeDeliveryConfig()) {
  return config.urls.dashboardTemplate.replaceAll('{storeId}', encodeURIComponent(storeId))
}

export function getZeDeliveryCronExpression(config = getZeDeliveryConfig()) {
  const safeInterval = Math.max(1, Math.min(59, Number(config.sync.intervalMinutes) || 10))
  return `*/${safeInterval} * * * *`
}

export function ensureZeDeliverySessionDirectory(config = getZeDeliveryConfig()) {
  const directoryPath = path.dirname(config.browser.sessionFilePath)
  fs.mkdirSync(directoryPath, { recursive: true })
  return directoryPath
}
