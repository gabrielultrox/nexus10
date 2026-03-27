import crypto from 'node:crypto'

import { getZeDeliveryConfig } from '../config/ze-delivery.js'

function readIncomingToken(request) {
  const explicitToken = request.header('x-ze-delivery-token')

  if (explicitToken) {
    return explicitToken.trim()
  }

  const authorization = request.header('authorization') ?? ''
  const [scheme, token] = authorization.split(' ')

  if (scheme?.toLowerCase() === 'bearer' && token) {
    return token.trim()
  }

  return ''
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function requireZeDeliverySyncAuth(request, response, next) {
  const config = getZeDeliveryConfig()

  if (!config.enabled) {
    response.status(503).json({
      error: 'Integracao com Zé Delivery desabilitada.',
    })
    return
  }

  const incomingToken = readIncomingToken(request)

  if (!incomingToken || !safeEqual(incomingToken, config.sync.token)) {
    response.status(401).json({
      error: 'Token da integracao Zé Delivery invalido.',
    })
    return
  }

  request.zeDeliveryAuth = {
    provider: 'ze-delivery-script',
  }
  next()
}
