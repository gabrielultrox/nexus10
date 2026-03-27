import { RequestValidationError, formatZodIssues } from '../errors/RequestValidationError.js'

function parseSource(schema, request, source, mapRequest) {
  const input = mapRequest ? mapRequest(request) : request[source]
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

export function validateRequest(schema, options = {}) {
  const { source = 'body', targetKey = source, mapRequest = null } = options

  return (request, _response, next) => {
    try {
      const parsed = parseSource(schema, request, source, mapRequest)

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

export function validateRequestSources(sourceConfig) {
  return (request, _response, next) => {
    try {
      const parsedSources = Object.entries(sourceConfig).reduce(
        (accumulator, [targetKey, config]) => {
          const normalizedConfig =
            config && typeof config.safeParse === 'function' ? { schema: config } : config

          const parsed = parseSource(
            normalizedConfig.schema,
            request,
            normalizedConfig.source ?? targetKey,
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
