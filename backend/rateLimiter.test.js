import express from 'express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createRateLimitMiddleware, isTrustedRateLimitIp } from './middleware/rateLimiter.js'

function createJsonRoute(responseBody = { ok: true }) {
  return (_request, response) => {
    response.json(responseBody)
  }
}

async function performRequests(url, { count, headers }) {
  const responses = []

  for (let index = 0; index < count; index += 1) {
    responses.push(
      await fetch(url, {
        method: 'POST',
        headers,
      }),
    )
  }

  return responses
}

let server
let baseUrl

beforeAll(async () => {
  const app = express()
  app.set('trust proxy', true)
  app.use(express.json())

  app.post(
    '/login',
    createRateLimitMiddleware({
      name: 'login-test',
      windowMs: 15 * 60 * 1000,
      max: 5,
      useRedisStore: false,
      keyGenerator: (request) => request.ip,
    }),
    createJsonRoute(),
  )

  app.post(
    '/api/protected',
    (request, _response, next) => {
      request.authUser = {
        uid: request.header('x-user-id') ?? 'user-1',
      }
      next()
    },
    createRateLimitMiddleware({
      name: 'api-authenticated-test',
      windowMs: 60 * 1000,
      max: 2,
      useRedisStore: false,
      keyGenerator: (request) => request.authUser?.uid ?? request.ip,
    }),
    createJsonRoute(),
  )

  app.post(
    '/webhooks/ifood/:storeId/:merchantId',
    createRateLimitMiddleware({
      name: 'ifood-webhook-test',
      windowMs: 60 * 1000,
      max: 2,
      useRedisStore: false,
      keyGenerator: (request) => `${request.params.storeId}:${request.params.merchantId}`,
    }),
    createJsonRoute(),
  )

  app.post(
    '/api/uploads/import',
    (request, _response, next) => {
      request.authUser = {
        uid: request.header('x-user-id') ?? 'user-1',
      }
      next()
    },
    createRateLimitMiddleware({
      name: 'file-upload-test',
      windowMs: 60 * 60 * 1000,
      max: 10,
      useRedisStore: false,
      keyGenerator: (request) => request.authUser?.uid ?? request.ip,
    }),
    createJsonRoute(),
  )

  app.get(
    '/public',
    createRateLimitMiddleware({
      name: 'public-test',
      windowMs: 60 * 1000,
      max: 2,
      useRedisStore: false,
      keyGenerator: (request) => request.ip,
    }),
    createJsonRoute(),
  )

  server = app.listen(0)

  await new Promise((resolve) => {
    server.once('listening', resolve)
  })

  const address = server.address()
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  if (!server) {
    return
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
})

describe('granular rate limiting', () => {
  it('limita login a 5 tentativas por IP e envia headers X-RateLimit', async () => {
    const responses = await performRequests(`${baseUrl}/login`, {
      count: 6,
      headers: {
        'x-forwarded-for': '203.0.113.10',
      },
    })

    expect(responses[0].headers.get('x-ratelimit-limit')).toBe('5')
    expect(responses[0].headers.get('x-ratelimit-remaining')).toBe('4')
    expect(responses[5].status).toBe(429)

    await expect(responses[5].json()).resolves.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      details: {
        limiter: 'login-test',
      },
    })
  })

  it('limita API autenticada por usuario e nao por IP compartilhado', async () => {
    const userOneResponses = await performRequests(`${baseUrl}/api/protected`, {
      count: 3,
      headers: {
        'x-forwarded-for': '203.0.113.11',
        'x-user-id': 'user-1',
      },
    })

    expect(userOneResponses[2].status).toBe(429)

    const otherUserResponse = await fetch(`${baseUrl}/api/protected`, {
      method: 'POST',
      headers: {
        'x-forwarded-for': '203.0.113.11',
        'x-user-id': 'user-2',
      },
    })

    expect(otherUserResponse.status).toBe(200)
  })

  it('limita webhook do iFood por merchant', async () => {
    const blockedResponses = await performRequests(`${baseUrl}/webhooks/ifood/store-1/merchant-1`, {
      count: 3,
      headers: {
        'x-forwarded-for': '198.51.100.20',
      },
    })

    expect(blockedResponses[2].status).toBe(429)

    const otherMerchantResponse = await fetch(`${baseUrl}/webhooks/ifood/store-1/merchant-2`, {
      method: 'POST',
      headers: {
        'x-forwarded-for': '198.51.100.20',
      },
    })

    expect(otherMerchantResponse.status).toBe(200)
  })

  it('limita uploads a 10 por hora por usuario', async () => {
    const responses = await performRequests(`${baseUrl}/api/uploads/import`, {
      count: 11,
      headers: {
        'x-forwarded-for': '198.51.100.30',
        'x-user-id': 'uploader-1',
      },
    })

    expect(responses[10].status).toBe(429)
    expect(responses[10].headers.get('retry-after')).toBeTruthy()
  })

  it('nao aplica rate limit para IP interno confiavel', async () => {
    expect(isTrustedRateLimitIp('10.0.0.25')).toBe(true)

    const responses = await performRequests(`${baseUrl}/login`, {
      count: 7,
      headers: {
        'x-forwarded-for': '10.0.0.25',
      },
    })

    expect(responses.every((response) => response.status === 200)).toBe(true)
  })
})
