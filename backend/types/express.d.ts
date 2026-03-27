import type { AuthenticatedUserContext, RequestLoggerLike } from './auth.js'

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUserContext
      log?: RequestLoggerLike
      validated?: Record<string, unknown>
    }
  }
}

export {}
