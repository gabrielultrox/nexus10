import fs from 'node:fs'
import path from 'node:path'

import pino from 'pino'

import { backendEnv } from '../config/env.js'

const LOG_LEVELS = ['debug', 'info', 'warn', 'error']
const logsDirectory = path.resolve(process.cwd(), 'logs')

function resolveLogLevel() {
  if (backendEnv.nodeEnv === 'test' || process.env.VITEST) {
    return 'silent'
  }

  const configured = String(backendEnv.logLevel ?? '').toLowerCase()
  return LOG_LEVELS.includes(configured) ? configured : 'info'
}

function createStreamTargets() {
  if (backendEnv.nodeEnv !== 'production') {
    return undefined
  }

  fs.mkdirSync(logsDirectory, { recursive: true })

  return pino.multistream([
    { stream: process.stdout },
    {
      stream: pino.destination({
        dest: path.join(logsDirectory, 'backend.log'),
        mkdir: true,
        sync: false,
      }),
    },
  ])
}

const baseOptions = {
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

export const logger = pino(baseOptions, createStreamTargets())

export function createLoggerContext(context = {}) {
  return logger.child(context)
}

export function serializeError(error) {
  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return {
    type: 'UnknownError',
    message: typeof error === 'string' ? error : 'Unexpected error',
    details: error,
  }
}
