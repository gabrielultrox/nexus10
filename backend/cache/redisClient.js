import { createClient } from 'redis'

import { backendEnv } from '../config/env.js'
import { createLoggerContext, serializeError } from '../logging/logger.js'

const redisLogger = createLoggerContext({ module: 'cache.redis' })

let redisClientPromise = null
let redisClientInstance = null

export function isRedisConfigured() {
  return Boolean(backendEnv.redisUrl)
}

function registerRedisEvents(client) {
  client.on('error', (error) => {
    redisLogger.warn(
      {
        context: 'cache.redis.error',
        error: serializeError(error),
      },
      'Redis error',
    )
  })

  client.on('reconnecting', () => {
    redisLogger.warn(
      {
        context: 'cache.redis.reconnecting',
      },
      'Redis reconnecting',
    )
  })

  client.on('ready', () => {
    redisLogger.info(
      {
        context: 'cache.redis.ready',
      },
      'Redis ready',
    )
  })
}

export async function getRedisClient() {
  if (!isRedisConfigured()) {
    return null
  }

  if (redisClientInstance?.isOpen) {
    return redisClientInstance
  }

  if (!redisClientPromise) {
    const client = createClient({
      url: backendEnv.redisUrl,
      socket: {
        connectTimeout: backendEnv.redisSocketTimeoutMs,
      },
    })

    registerRedisEvents(client)

    redisClientPromise = client
      .connect()
      .then(() => {
        redisClientInstance = client
        return client
      })
      .catch((error) => {
        redisLogger.warn(
          {
            context: 'cache.redis.connect_failed',
            error: serializeError(error),
          },
          'Redis unavailable, using fallback data source',
        )
        redisClientPromise = null
        redisClientInstance = null
        return null
      })
  }

  return redisClientPromise
}

export async function disconnectRedisClient() {
  if (!redisClientInstance) {
    return
  }

  try {
    await redisClientInstance.quit()
  } catch (error) {
    redisLogger.warn(
      {
        context: 'cache.redis.disconnect_failed',
        error: serializeError(error),
      },
      'Redis quit failed',
    )
  } finally {
    redisClientInstance = null
    redisClientPromise = null
  }
}
