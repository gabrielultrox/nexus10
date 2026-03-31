import rateLimit from 'express-rate-limit'

import { backendEnv } from '../config/env.js'
import { RateLimitExceededError } from '../errors/RateLimitExceededError.js'
import { getRedisClient } from '../cache/redisClient.js'
import { createLoggerContext, serializeError } from '../logging/logger.js'

const rateLimitLogger = createLoggerContext({ module: 'rate-limit' })

function normalizeIpAddress(ipAddress = '') {
  return String(ipAddress)
    .trim()
    .replace(/^::ffff:/, '')
}

function isLoopbackIp(ipAddress) {
  return ['127.0.0.1', '::1', 'localhost'].includes(normalizeIpAddress(ipAddress))
}

function isPrivateIpv4(ipAddress) {
  const normalizedIp = normalizeIpAddress(ipAddress)

  return (
    normalizedIp.startsWith('10.') ||
    normalizedIp.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalizedIp)
  )
}

function parseTrustedIps(rawTrustedIps) {
  return String(rawTrustedIps ?? '')
    .split(',')
    .map((ip) => normalizeIpAddress(ip))
    .filter(Boolean)
}

function createCounterMemoryStore() {
  const counters = new Map()

  return {
    async increment(key, windowMs) {
      const now = Date.now()
      const current = counters.get(key)

      if (!current || current.resetTime <= now) {
        const resetTime = now + windowMs
        const nextValue = {
          totalHits: 1,
          resetTime,
        }

        counters.set(key, nextValue)
        return nextValue
      }

      current.totalHits += 1
      counters.set(key, current)
      return current
    },

    async decrement(key) {
      const current = counters.get(key)

      if (!current) {
        return
      }

      current.totalHits = Math.max(0, current.totalHits - 1)
      counters.set(key, current)
    },

    async resetKey(key) {
      counters.delete(key)
    },

    clear() {
      counters.clear()
    },
  }
}

class RedisBackedRateLimitStore {
  constructor({ prefix = 'nexus10:rate-limit', fallbackStore }) {
    this.prefix = prefix
    this.fallbackStore = fallbackStore
    this.localKeys = false
  }

  async increment(key) {
    const namespacedKey = `${this.prefix}:${key}`
    const windowMs = this.windowMs

    try {
      const client = await getRedisClient()

      if (!client) {
        const memoryResult = await this.fallbackStore.increment(namespacedKey, windowMs)

        return {
          totalHits: memoryResult.totalHits,
          resetTime: new Date(memoryResult.resetTime),
        }
      }

      const transactionResult = await client.multi().incr(namespacedKey).pttl(namespacedKey).exec()
      const totalHits = Number(transactionResult?.[0] ?? 0)
      let ttlMs = Number(transactionResult?.[1] ?? -1)

      if (ttlMs < 0) {
        await client.pExpire(namespacedKey, windowMs)
        ttlMs = windowMs
      }

      return {
        totalHits,
        resetTime: new Date(Date.now() + ttlMs),
      }
    } catch (error) {
      rateLimitLogger.warn(
        {
          context: 'rate_limit.redis.increment_failed',
          key: namespacedKey,
          error: serializeError(error),
        },
        'Redis rate-limit store failed, using memory fallback',
      )
      const memoryResult = await this.fallbackStore.increment(namespacedKey, windowMs)

      return {
        totalHits: memoryResult.totalHits,
        resetTime: new Date(memoryResult.resetTime),
      }
    }
  }

  async decrement(key) {
    const namespacedKey = `${this.prefix}:${key}`

    try {
      const client = await getRedisClient()

      if (!client) {
        await this.fallbackStore.decrement(namespacedKey)
        return
      }

      await client.decr(namespacedKey)
    } catch {
      await this.fallbackStore.decrement(namespacedKey)
    }
  }

  async resetKey(key) {
    const namespacedKey = `${this.prefix}:${key}`

    try {
      const client = await getRedisClient()

      if (!client) {
        await this.fallbackStore.resetKey(namespacedKey)
        return
      }

      await client.del(namespacedKey)
    } catch {
      await this.fallbackStore.resetKey(namespacedKey)
    }
  }
}

function createExpressStore({ prefix, windowMs, useRedisStore }) {
  const fallbackStore = createCounterMemoryStore()

  if (!useRedisStore) {
    return {
      localKeys: true,
      async increment(key) {
        const result = await fallbackStore.increment(key, windowMs)
        return {
          totalHits: result.totalHits,
          resetTime: new Date(result.resetTime),
        }
      },
      decrement: (key) => fallbackStore.decrement(key),
      resetKey: (key) => fallbackStore.resetKey(key),
      clear: () => fallbackStore.clear(),
    }
  }

  const store = new RedisBackedRateLimitStore({
    prefix,
    fallbackStore,
  })

  store.windowMs = windowMs
  return store
}

function buildRateLimitKey(namespace, request, resolver) {
  const resolvedKey = resolver(request)
  return `${namespace}:${resolvedKey || 'anonymous'}`
}

function create429Handler(name) {
  return (request, response, _next, options) => {
    const retryAfterSeconds = Math.max(1, Math.ceil(options.windowMs / 1000))
    const error = new RateLimitExceededError('Limite de requisicoes excedido para esta rota.', {
      limiter: name,
      retryAfterSeconds,
      limit: options.limit,
    })

    if (request.log?.warn) {
      request.log.warn(
        {
          context: 'rate_limit.blocked',
          limiter: name,
          path: request.originalUrl,
          ipAddress: normalizeIpAddress(request.ip),
          userId: request.authUser?.uid ?? null,
        },
        error.message,
      )
    }

    response.setHeader('Retry-After', String(retryAfterSeconds))
    response.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details,
    })
  }
}

export function isTrustedRateLimitIp(ipAddress, trustedIps = backendEnv.rateLimitTrustedIps ?? []) {
  const normalizedIp = normalizeIpAddress(ipAddress)

  if (!normalizedIp) {
    return false
  }

  return (
    trustedIps.includes(normalizedIp) || isLoopbackIp(normalizedIp) || isPrivateIpv4(normalizedIp)
  )
}

export function createRateLimitMiddleware({
  name,
  windowMs,
  max,
  keyGenerator,
  skip,
  useRedisStore = backendEnv.nodeEnv === 'production',
}) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: true,
    validate: {
      xForwardedForHeader: false,
    },
    keyGenerator: (request) => buildRateLimitKey(name, request, keyGenerator),
    skip: (request, response) => {
      if (isTrustedRateLimitIp(request.ip)) {
        return true
      }

      return skip ? skip(request, response) : false
    },
    store: createExpressStore({
      prefix: `${backendEnv.redisKeyPrefix}:rate-limit:${name}`,
      windowMs,
      useRedisStore,
    }),
    handler: create429Handler(name),
    message: {
      error: 'Limite de requisicoes excedido para esta rota.',
    },
  })
}

export const loginRateLimiter = createRateLimitMiddleware({
  name: 'login',
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (request) => normalizeIpAddress(request.ip),
})

export const authenticatedApiRateLimiter = createRateLimitMiddleware({
  name: 'api-authenticated',
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (request) => request.authUser?.uid ?? normalizeIpAddress(request.ip),
})

export const ifoodWebhookRateLimiter = createRateLimitMiddleware({
  name: 'ifood-webhook',
  windowMs: 60 * 1000,
  max: 50,
  keyGenerator: (request) =>
    `${request.params.storeId ?? 'unknown-store'}:${request.params.merchantId ?? 'unknown-merchant'}`,
})

export const fileUploadRateLimiter = createRateLimitMiddleware({
  name: 'file-upload',
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (request) => request.authUser?.uid ?? normalizeIpAddress(request.ip),
})

export const publicRateLimiter = createRateLimitMiddleware({
  name: 'public',
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (request) => normalizeIpAddress(request.ip),
})
