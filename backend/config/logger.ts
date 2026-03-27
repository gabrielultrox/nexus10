import fs from 'node:fs'
import path from 'node:path'
import { Writable } from 'node:stream'
import { performance } from 'node:perf_hooks'

import pino, { type Logger as PinoLogger, type LoggerOptions } from 'pino'

import type { LoggerContext, RequestLoggerLike } from '../types/index.js'
import { backendEnv } from './env.js'

const VALID_LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const
const LOG_DIRECTORY = path.resolve(process.cwd(), 'backend', 'logs')
const LOG_FILE_PREFIX = 'nexus10-backend'

type ValidLogLevel = (typeof VALID_LOG_LEVELS)[number]

function resolveLogLevel(): ValidLogLevel | 'silent' {
  if (backendEnv.nodeEnv === 'test' || process.env.VITEST) {
    return 'silent'
  }

  const configuredLevel = String(backendEnv.logLevel ?? 'info')
    .trim()
    .toLowerCase() as ValidLogLevel
  return VALID_LOG_LEVELS.includes(configuredLevel) ? configuredLevel : 'info'
}

function toDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

function ensureLogDirectory(): void {
  fs.mkdirSync(LOG_DIRECTORY, { recursive: true })
}

function buildLogFilePath(date = new Date()): string {
  return path.join(LOG_DIRECTORY, `${LOG_FILE_PREFIX}-${toDateKey(date)}.jsonl`)
}

class DailyRotatingJsonStream extends Writable {
  private currentDateKey = ''
  private currentStream: fs.WriteStream | null = null

  private rotateIfNeeded(): void {
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

  override _write(
    chunk: string | Uint8Array,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    try {
      this.rotateIfNeeded()
      this.currentStream?.write(chunk, encoding, callback)
    } catch (error) {
      callback(error as Error)
    }
  }

  override _final(callback: (error?: Error | null) => void): void {
    if (!this.currentStream) {
      callback()
      return
    }

    this.currentStream.end(callback)
  }
}

function createLoggerTransport(): Writable | ReturnType<typeof pino.transport> | undefined {
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

const loggerOptions: LoggerOptions = {
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

export const logger: PinoLogger = pino(loggerOptions, createLoggerTransport())

export function createLoggerContext(context: LoggerContext = {}): PinoLogger {
  return logger.child(context)
}

export function createRequestLoggerContext({
  requestId,
  method,
  route,
  ipAddress,
  userId = null,
}: {
  requestId?: string
  method?: string
  route?: string
  ipAddress?: string
  userId?: string | null
} = {}): PinoLogger {
  return logger.child({
    request_id: requestId,
    method,
    route,
    ip_address: ipAddress,
    user_id: userId,
  })
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const typedError = error as Error & {
      code?: string
      status?: number
      cause?: unknown
      payload?: unknown
    }

    return {
      type: typedError.name,
      message: typedError.message,
      stack: typedError.stack,
      code: typedError.code ?? undefined,
      status: typedError.status ?? undefined,
      cause: typedError.cause ?? undefined,
      payload: typedError.payload ?? undefined,
    }
  }

  return {
    type: 'UnknownError',
    message: typeof error === 'string' ? error : 'Unexpected error',
    details: error,
  }
}

export function withMethodLogging<TArgs extends unknown[], TResult>(
  {
    logger: scopedLogger = logger,
    action,
    startLevel = 'debug',
    successLevel = 'info',
    errorLevel = 'error',
    getStartPayload,
    getSuccessPayload,
  }: {
    logger?: RequestLoggerLike
    action: string
    startLevel?: keyof RequestLoggerLike
    successLevel?: keyof RequestLoggerLike
    errorLevel?: keyof RequestLoggerLike
    getStartPayload?: (...args: TArgs) => Record<string, unknown>
    getSuccessPayload?: (result: TResult, ...args: TArgs) => Record<string, unknown>
  },
  handler: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    const startedAt = performance.now()
    const startLogger = scopedLogger[startLevel] as
      | ((payload: unknown, message?: string) => void)
      | undefined
    const successLogger = scopedLogger[successLevel] as
      | ((payload: unknown, message?: string) => void)
      | undefined
    const errorLogger = scopedLogger[errorLevel] as
      | ((payload: unknown, message?: string) => void)
      | undefined

    if (typeof startLogger === 'function') {
      startLogger(
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

      if (typeof successLogger === 'function') {
        successLogger(
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

      if (typeof errorLogger === 'function') {
        errorLogger(
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

export function getBackendLogDirectory(): string {
  return LOG_DIRECTORY
}

export function getCurrentBackendLogFilePath(): string {
  return buildLogFilePath()
}
