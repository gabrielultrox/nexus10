import type {
  ApiErrorResponseBody,
  ApiSuccessResponseBody,
  AuthenticatedUserContext,
  RequestLoggerLike,
  RequestValidationPayload,
} from './index.js'

declare global {
  namespace Express {
    interface Request {
      id?: string
      authUser?: AuthenticatedUserContext
      log?: RequestLoggerLike
      validated?: RequestValidationPayload & Record<string, unknown>
    }

    interface Response {
      success?<TData>(payload: ApiSuccessResponseBody<TData>): this
      fail?(payload: ApiErrorResponseBody): this
      locals: Record<string, unknown> & {
        audit?: {
          action?: 'create' | 'update' | 'delete' | 'approve' | 'reject'
          module?: string
          entityType?: string
          entityId?: string
          description?: string
          reason?: string | null
          before?: unknown
          after?: unknown
          metadata?: Record<string, unknown>
          notifyAdmin?: boolean
        }
      }
    }
  }
}

export {}
