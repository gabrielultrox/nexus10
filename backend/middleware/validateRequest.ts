import type { Request, RequestHandler } from 'express'
import type { ZodIssue } from 'zod'

import { RequestValidationError, formatZodIssues } from '../errors/RequestValidationError.js'
import type {
  ValidationMiddlewareOptions,
  ValidationSource,
  ValidationSourceConfig,
  ValidationSourceConfigEntry,
} from '../types/index.js'

interface SafeParseFailure {
  success: false
  error: {
    issues: ZodIssue[]
  }
}

interface SafeParseSuccess<TParsed> {
  success: true
  data: TParsed
}

interface SchemaLike<TParsed> {
  safeParse: (input: unknown) => SafeParseSuccess<TParsed> | SafeParseFailure
}

type RequestSourceLookup = Request &
  Partial<Record<ValidationSource, unknown>> &
  Record<string, unknown>

function parseSource<TParsed, TRequestSource = unknown>(
  schema: SchemaLike<TParsed>,
  request: RequestSourceLookup,
  source: ValidationSource,
  mapRequest?: ((request: any) => unknown) | null,
): TParsed {
  const input = mapRequest ? mapRequest(request as TRequestSource) : request[source]
  const result = schema.safeParse(input)

  if (!result.success) {
    throw new RequestValidationError(
      `Falha de validacao em ${source}.`,
      formatZodIssues(result.error.issues),
      source,
    )
  }

  return result.data
}

function normalizeSourceConfigEntry(
  targetKey: string,
  config: ValidationSourceConfig,
): ValidationSourceConfigEntry {
  if (config && typeof config === 'object' && 'safeParse' in config) {
    return {
      schema: config as SchemaLike<unknown>,
      source: targetKey as ValidationSource,
      mapRequest: undefined,
    }
  }

  return config as ValidationSourceConfigEntry
}

export function validateRequest<TParsed, TRequestSource = Request>(
  schema: SchemaLike<TParsed>,
  options: ValidationMiddlewareOptions<TRequestSource> = {},
): RequestHandler {
  const { source = 'body', targetKey = source, mapRequest = null } = options

  return (request, _response, next) => {
    try {
      const parsed = parseSource(schema, request as RequestSourceLookup, source, mapRequest)

      request.validated = {
        ...(request.validated ?? {}),
        [targetKey]: parsed,
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

export function validateRequestSources(
  sourceConfig: Record<string, ValidationSourceConfig>,
): RequestHandler {
  return (request, _response, next) => {
    try {
      const parsedSources = Object.entries(sourceConfig).reduce<Record<string, unknown>>(
        (accumulator, [targetKey, config]) => {
          const normalizedConfig = normalizeSourceConfigEntry(targetKey, config)
          const parsed = parseSource(
            normalizedConfig.schema as SchemaLike<unknown>,
            request as RequestSourceLookup,
            (normalizedConfig.source ?? targetKey) as ValidationSource,
            normalizedConfig.mapRequest ?? null,
          )

          return {
            ...accumulator,
            [targetKey]: parsed,
          }
        },
        {},
      )

      request.validated = {
        ...(request.validated ?? {}),
        ...parsedSources,
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}
