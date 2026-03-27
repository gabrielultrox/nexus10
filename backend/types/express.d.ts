import type { AuthenticatedUserContext, RequestLoggerLike } from './auth.js'

declare global {
  namespace Express {
    interface Request {
      id?: string
      authUser?: AuthenticatedUserContext
      log?: RequestLoggerLike
      validated?: Record<string, unknown>
    }
  }
}

export {}
