import fs from 'node:fs'
import path from 'node:path'
import { Writable } from 'node:stream'

import pino from 'pino'

import { backendEnv } from './env.js'

const VALID_LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal']
const LOG_DIRECTORY = path.resolve(process.cwd(), 'backend', 'logs')
const LOG_FILE_PREFIX = 'nexus10-backend'

function resolveLogLevel() {
  if (backendEnv.nodeEnv === 'test' || process.env.VITEST) {
    return 'silent'
  }

  const configuredLevel = String(backendEnv.logLevel ?? 'info')
    .trim()
    .toLowerCase()
  return VALID_LOG_LEVELS.includes(configuredLevel) ? configuredLevel : 'info'
}

function toDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function ensureLogDirectory() {
  fs.mkdirSync(LOG_DIRECTORY, { recursive: true })
}

function buildLogFilePath(date = new Date()) {
  return path.join(LOG_DIRECTORY, `${LOG_FILE_PREFIX}-${toDateKey(date)}.jsonl`)
}

class DailyRotatingJsonStream extends Writable {
  constructor() {
    super()
    this.currentDateKey = ''
    this.currentStream = null
  }

  rotateIfNeeded() {
    const nextDateKey = toDateKey()

    if (this.currentStream && this.currentDateKey === nextDateKey) {
      return
    }

    ensureLogDirectory()

    if (this.currentStream) {
      this.currentStream.end()
    }

    this.currentDateKey = nextDateKey
    this.currentStream = fs.createWriteStream(buildLogFilePath(), {
      flags: 'a',
      encoding: 'utf8',
    })
  }

  _write(chunk, encoding, callback) {
    try {
      this.rotateIfNeeded()
      this.currentStream.write(chunk, encoding, callback)
    } catch (error) {
      callback(error)
    }
  }

  _final(callback) {
    if (!this.currentStream) {
      callback()
      return
    }

    this.currentStream.end(callback)
  }
}

function createLoggerTransport() {
  if (backendEnv.nodeEnv === 'test' || process.env.VITEST) {
    return undefined
  }

  if (backendEnv.nodeEnv === 'production') {
    return new DailyRotatingJsonStream()
  }

  return pino.transport({
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      singleLine: false,
      ignore: 'pid,hostname',
      messageFormat: '{msg}',
    },
  })
}

const loggerOptions = {
  level: resolveLogLevel(),
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'nexus10-backend',
    environment: backendEnv.nodeEnv,
  },
  formatters: {
    level(label) {
      return { level: label }
    },
  },
}

export const logger = pino(loggerOptions, createLoggerTransport())

export function createLoggerContext(context = {}) {
  return logger.child(context)
}

export function createRequestLoggerContext({
  requestId,
  method,
  route,
  ipAddress,
  userId = null,
} = {}) {
  return logger.child({
    request_id: requestId,
    method,
    route,
    ip_address: ipAddress,
    user_id: userId,
  })
}

export function serializeError(error) {
  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code ?? undefined,
      status: error.status ?? undefined,
      cause: error.cause ?? undefined,
      payload: error.payload ?? undefined,
    }
  }

  return {
    type: 'UnknownError',
    message: typeof error === 'string' ? error : 'Unexpected error',
    details: error,
  }
}

export function withMethodLogging(
  {
    logger: scopedLogger = logger,
    action,
    startLevel = 'debug',
    successLevel = 'info',
    errorLevel = 'error',
    getStartPayload,
    getSuccessPayload,
  },
  handler,
) {
  return async (...args) => {
    const startedAt = performance.now()

    if (typeof scopedLogger[startLevel] === 'function') {
      scopedLogger[startLevel](
        {
          action,
          ...(getStartPayload ? getStartPayload(...args) : {}),
        },
        `${action} started`,
      )
    }

    try {
      const result = await handler(...args)
      const durationMs = Number((performance.now() - startedAt).toFixed(2))

      if (typeof scopedLogger[successLevel] === 'function') {
        scopedLogger[successLevel](
          {
            action,
            duration_ms: durationMs,
            ...(getSuccessPayload ? getSuccessPayload(result, ...args) : {}),
          },
          `${action} completed`,
        )
      }

      return result
    } catch (error) {
      const durationMs = Number((performance.now() - startedAt).toFixed(2))

      if (typeof scopedLogger[errorLevel] === 'function') {
        scopedLogger[errorLevel](
          {
            action,
            duration_ms: durationMs,
            error: serializeError(error),
            ...(getStartPayload ? getStartPayload(...args) : {}),
          },
          `${action} failed`,
        )
      }

      throw error
    }
  }
}

export function getBackendLogDirectory() {
  return LOG_DIRECTORY
}

export function getCurrentBackendLogFilePath() {
  return buildLogFilePath()
}
