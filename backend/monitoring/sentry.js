import * as Sentry from '@sentry/node';

import { backendEnv } from '../config/env.js';
import { logger, serializeError } from '../logging/logger.js';

let sentryInitialized = false;

export function isSentryEnabled() {
  return Boolean(backendEnv.sentryDsn);
}

export function initializeSentry() {
  if (sentryInitialized || !isSentryEnabled()) {
    return;
  }

  Sentry.init({
    dsn: backendEnv.sentryDsn,
    enabled: true,
    environment: backendEnv.nodeEnv,
    release: backendEnv.sentryRelease || undefined,
    tracesSampleRate: backendEnv.sentryTracesSampleRate,
    sendDefaultPii: false,
  });

  sentryInitialized = true;

  logger.info({
    context: 'monitoring.sentry.init',
    tracesSampleRate: backendEnv.sentryTracesSampleRate,
    environment: backendEnv.nodeEnv,
  }, 'Sentry monitoring initialized');
}

export function captureError(error, context = {}) {
  if (!isSentryEnabled()) {
    return null;
  }

  initializeSentry();

  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      if (value == null) {
        return;
      }

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        scope.setTag(key, String(value));
        return;
      }

      scope.setContext(key, value);
    });

    Sentry.captureException(error instanceof Error ? error : new Error('Unknown monitored error'));
  });

  return true;
}

export function captureMessage(message, context = {}, level = 'warning') {
  if (!isSentryEnabled()) {
    return null;
  }

  initializeSentry();

  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      if (value == null) {
        return;
      }

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        scope.setTag(key, String(value));
        return;
      }

      scope.setContext(key, value);
    });

    Sentry.captureMessage(message, level);
  });

  return true;
}

export async function flushSentry(timeout = 2000) {
  if (!isSentryEnabled()) {
    return false;
  }

  initializeSentry();
  return Sentry.flush(timeout);
}

export function buildMonitoredErrorPayload(error, context = {}) {
  return {
    ...context,
    error: serializeError(error),
  };
}
