import { RequestValidationError, formatZodIssues } from '../errors/RequestValidationError.js';

export function validateRequest(schema, options = {}) {
  const {
    source = 'body',
    mapRequest = null,
  } = options;

  return (request, _response, next) => {
    const input = mapRequest ? mapRequest(request) : request[source];
    const result = schema.safeParse(input);

    if (!result.success) {
      next(new RequestValidationError(
        'Dados de entrada invalidos.',
        formatZodIssues(result.error.issues),
        source,
      ));
      return;
    }

    request.validated = {
      ...(request.validated ?? {}),
      [source]: result.data,
    };

    next();
  };
}
