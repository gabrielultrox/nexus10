import { backendEnv } from '../config/env.js';
import { createLoggerContext, serializeError } from '../logging/logger.js';
import { getRedisClient } from './redisClient.js';

const cacheLogger = createLoggerContext({ module: 'cache.service' });

function normalizePart(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9:_-]/g, '_');
}

export function buildCacheKey(...parts) {
  return [backendEnv.redisKeyPrefix, ...parts.map(normalizePart).filter(Boolean)].join(':');
}

export async function cacheGet(key) {
  try {
    const client = await getRedisClient();

    if (!client) {
      return null;
    }

    const rawValue = await client.get(key);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch (error) {
    cacheLogger.warn({
      context: 'cache.get',
      key,
      error: serializeError(error),
    }, 'Cache get failed');
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds) {
  try {
    const client = await getRedisClient();

    if (!client) {
      return false;
    }

    const serializedValue = JSON.stringify(value);

    if (ttlSeconds && ttlSeconds > 0) {
      await client.set(key, serializedValue, { EX: ttlSeconds });
    } else {
      await client.set(key, serializedValue);
    }

    return true;
  } catch (error) {
    cacheLogger.warn({
      context: 'cache.set',
      key,
      ttlSeconds,
      error: serializeError(error),
    }, 'Cache set failed');
    return false;
  }
}

export async function cacheInvalidate(keys) {
  const normalizedKeys = Array.isArray(keys) ? keys.filter(Boolean) : [keys].filter(Boolean);

  if (!normalizedKeys.length) {
    return 0;
  }

  try {
    const client = await getRedisClient();

    if (!client) {
      return 0;
    }

    return client.del(normalizedKeys);
  } catch (error) {
    cacheLogger.warn({
      context: 'cache.invalidate',
      keys: normalizedKeys,
      error: serializeError(error),
    }, 'Cache invalidate failed');
    return 0;
  }
}

export async function cacheRemember({ key, ttlSeconds, loader, log = cacheLogger }) {
  const cachedValue = await cacheGet(key);

  if (cachedValue != null) {
    return cachedValue;
  }

  const freshValue = await loader();

  if (freshValue != null) {
    await cacheSet(key, freshValue, ttlSeconds);
  }

  return freshValue;
}

export function createCachedMethod({ keyPrefix, ttlSeconds, keyBuilder, logger = cacheLogger }, method) {
  return async function cachedMethod(...args) {
    const key = buildCacheKey(
      keyPrefix,
      ...(typeof keyBuilder === 'function' ? keyBuilder(...args) : []),
    );

    return cacheRemember({
      key,
      ttlSeconds,
      log: logger,
      loader: () => method(...args),
    });
  };
}
