export class RequestValidationError extends Error {
  constructor(message = 'Dados de entrada invalidos.', details = {}, source = 'body') {
    super(message)
    this.name = 'RequestValidationError'
    this.code = 'VALIDATION_ERROR'
    this.statusCode = 400
    this.details = details
    this.source = source
  }
}

export function formatZodIssues(issues = []) {
  return issues.reduce((accumulator, issue) => {
    const path = issue.path?.length ? issue.path.join('.') : 'root'

    if (!accumulator[path]) {
      accumulator[path] = []
    }

    accumulator[path].push(issue.message)
    return accumulator
  }, {})
}
