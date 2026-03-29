import helmet from 'helmet'

import { backendEnv } from './env.js'

const DEFAULT_USER_AGENT_BLOCKLIST = ['sqlmap', 'nikto', 'masscan', 'zgrab', 'acunetix', 'nessus']

export function normalizeOrigin(origin = '') {
  if (!origin) {
    return ''
  }

  try {
    const parsedOrigin = new URL(origin)

    if (!['http:', 'https:'].includes(parsedOrigin.protocol)) {
      return ''
    }

    if (parsedOrigin.username || parsedOrigin.password) {
      return ''
    }

    return parsedOrigin.origin
  } catch {
    return ''
  }
}

export function isDevelopmentEnvironment() {
  return backendEnv.nodeEnv !== 'production'
}

export function getTrustProxySetting() {
  return backendEnv.trustProxy
}

export function getAllowedOrigins() {
  const configuredOrigins = backendEnv.frontendOrigin.map(normalizeOrigin).filter(Boolean)

  if (isDevelopmentEnvironment()) {
    configuredOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173')
  }

  return Array.from(new Set(configuredOrigins))
}

export function isAllowedOrigin(origin) {
  if (!origin) {
    return true
  }

  return getAllowedOrigins().includes(normalizeOrigin(origin))
}

export function getBlockedUserAgents() {
  const configuredUserAgents = backendEnv.securityUserAgentBlocklist ?? []
  return Array.from(
    new Set(
      [...DEFAULT_USER_AGENT_BLOCKLIST, ...configuredUserAgents]
        .map((token) => String(token).trim().toLowerCase())
        .filter(Boolean),
    ),
  )
}

export function isBlockedUserAgent(userAgent = '') {
  const normalizedUserAgent = String(userAgent).toLowerCase()

  if (!normalizedUserAgent) {
    return false
  }

  return getBlockedUserAgents().some((token) => normalizedUserAgent.includes(token))
}

export function isSecureRequest(request) {
  if (request.secure === true) {
    return true
  }

  const forwardedProto = String(request.headers['x-forwarded-proto'] ?? '')
    .split(',')[0]
    .trim()
    .toLowerCase()

  return forwardedProto === 'https'
}

export function buildContentSecurityPolicyDirectives() {
  const allowedConnectSources = ["'self'", ...getAllowedOrigins()]

  return {
    defaultSrc: ["'none'"],
    baseUri: ["'none'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    objectSrc: ["'none'"],
    imgSrc: ["'self'", 'data:'],
    fontSrc: ["'self'", 'data:'],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    connectSrc: Array.from(new Set(allowedConnectSources)),
    manifestSrc: ["'self'"],
  }
}

export function createHelmetSecurityConfig() {
  return {
    contentSecurityPolicy: {
      directives: buildContentSecurityPolicyDirectives(),
    },
    crossOriginResourcePolicy: false,
    frameguard: {
      action: 'deny',
    },
    hsts:
      backendEnv.nodeEnv === 'production'
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
    noSniff: true,
    referrerPolicy: {
      policy: 'no-referrer',
    },
  }
}

export function applyPermissionsPolicy(response) {
  response.setHeader(
    'Permissions-Policy',
    [
      'accelerometer=()',
      'camera=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'payment=()',
      'usb=()',
    ].join(', '),
  )
}

export function createSecurityHeadersMiddleware() {
  const helmetMiddleware = helmet(createHelmetSecurityConfig())

  return (request, response, next) => {
    applyPermissionsPolicy(response)
    helmetMiddleware(request, response, next)
  }
}

export function createUserAgentGuard() {
  return (request, response, next) => {
    if (isBlockedUserAgent(request.get('user-agent'))) {
      response.status(403).json({
        error: 'User-Agent bloqueado pela politica de seguranca.',
      })
      return
    }

    next()
  }
}

export function createHttpsEnforcementMiddleware() {
  return (request, response, next) => {
    if (backendEnv.nodeEnv !== 'production') {
      next()
      return
    }

    if (isSecureRequest(request)) {
      next()
      return
    }

    response.status(426).json({
      error: 'HTTPS obrigatorio neste ambiente.',
    })
  }
}

export function createCorsProtectionMiddleware() {
  return (request, response, next) => {
    const origin = request.headers.origin
    const normalizedOrigin = normalizeOrigin(origin)

    if (!origin) {
      next()
      return
    }

    if (!normalizedOrigin || !isAllowedOrigin(normalizedOrigin)) {
      response.status(403).json({
        error: 'Origem nao autorizada para esta API.',
      })
      return
    }

    response.header('Access-Control-Allow-Origin', normalizedOrigin)
    response.header('Vary', 'Origin')
    response.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    response.header('Access-Control-Allow-Credentials', 'true')
    response.header('Access-Control-Max-Age', String(backendEnv.corsPreflightMaxAgeSeconds))

    if (request.method === 'OPTIONS') {
      response.status(204).end()
      return
    }

    next()
  }
}
