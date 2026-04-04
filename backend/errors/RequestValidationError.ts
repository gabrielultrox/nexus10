import type { ZodIssue } from 'zod'

import type { ValidationSource } from '../types/index.js'

export class RequestValidationError extends Error {
  code = 'VALIDATION_ERROR'
  statusCode = 400
  details: Record<string, string[]>
  source: ValidationSource

  constructor(
    message = 'Dados de entrada invalidos.',
    details: Record<string, string[]> = {},
    source: ValidationSource = 'body',
  ) {
    super(message)
    this.name = 'RequestValidationError'
    this.details = details
    this.source = source
  }
}

export function formatZodIssues(issues: ZodIssue[] = []): Record<string, string[]> {
  return issues.reduce<Record<string, string[]>>((accumulator, issue) => {
    const path = issue.path?.length ? issue.path.join('.') : 'root'

    if (!accumulator[path]) {
      accumulator[path] = []
    }

    accumulator[path].push(issue.message)
    return accumulator
  }, {})
}
