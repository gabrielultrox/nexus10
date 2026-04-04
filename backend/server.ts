import app from './app.js'
import { backendEnv } from './config/env.js'
import { logger, serializeError } from './logging/logger.js'
import {
  buildMonitoredErrorPayload,
  captureError,
  flushSentry,
  initializeSentry,
} from './monitoring/sentry.js'

initializeSentry()

const server = app.listen(backendEnv.port, () => {
  logger.info(
    {
      context: 'server.start',
      port: backendEnv.port,
      environment: backendEnv.nodeEnv,
    },
    `nexus10 backend ativo em http://127.0.0.1:${backendEnv.port} (${backendEnv.nodeEnv})`,
  )
})

server.on('error', (error: Error) => {
  logger.error(
    {
      context: 'server.start',
      error: serializeError(error),
    },
    'Backend server failed to start',
  )
  captureError(
    error,
    buildMonitoredErrorPayload(error, {
      context: 'server.start',
      port: backendEnv.port,
    }),
  )
})

process.on('unhandledRejection', async (reason) => {
  logger.error(
    {
      context: 'process.unhandledRejection',
      error: serializeError(reason),
    },
    'Unhandled promise rejection',
  )

  captureError(
    reason,
    buildMonitoredErrorPayload(reason, {
      context: 'process.unhandledRejection',
    }),
  )

  await flushSentry()
})

process.on('uncaughtException', async (error: Error) => {
  logger.error(
    {
      context: 'process.uncaughtException',
      error: serializeError(error),
    },
    'Uncaught exception',
  )

  captureError(
    error,
    buildMonitoredErrorPayload(error, {
      context: 'process.uncaughtException',
    }),
  )

  await flushSentry()
})
