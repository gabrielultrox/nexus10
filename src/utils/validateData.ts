import type { ZodError, ZodTypeAny } from 'zod'

import { ValidationError } from '@services/errorHandler'

export interface IValidationResult<T> {
  success: boolean
  data?: T
  errors?: Record<string, string[]>
}

function mapValidationErrors(error: Pick<ZodError, 'issues'>) {
  return error.issues.reduce<Record<string, string[]>>((accumulator, issue) => {
    const path = issue.path.length > 0 ? issue.path.map((segment) => String(segment)).join('.') : 'root'
    accumulator[path] = [...(accumulator[path] ?? []), issue.message]
    return accumulator
  }, {})
}

export function validateData<T>(schema: ZodTypeAny, data: unknown): IValidationResult<T> {
  const result = schema.safeParse(data)

  if (result.success) {
    return {
      success: true,
      data: result.data as T,
    }
  }

  return {
    success: false,
    errors: mapValidationErrors(result.error),
  }
}

export function validateOrThrow<T>(schema: ZodTypeAny, data: unknown, context?: Record<string, unknown>): T {
  const result = validateData<T>(schema, data)

  if (result.success) {
    return result.data as T
  }

  const message = Object.values(result.errors ?? {})
    .flat()
    .join(' | ')

  throw new ValidationError(message || 'Falha de validacao.', result.errors, context)
}

export function createValidator<T>(schema: ZodTypeAny) {
  return {
    validate: (data: unknown) => validateData<T>(schema, data),
    validateOrThrow: (data: unknown, context?: Record<string, unknown>) => (
      validateOrThrow<T>(schema, data, context)
    ),
  }
}

export async function validateFields<T extends Record<string, unknown>>(
  schemas: Partial<Record<keyof T, ZodTypeAny>>,
  data: Partial<T>,
): Promise<IValidationResult<Partial<T>>> {
  const entries = await Promise.all(
    Object.entries(schemas).map(async ([key, schema]) => {
      if (!schema) {
        return [key, { success: true, data: data[key as keyof T] }] as const
      }

      return [key, validateData(schema, data[key as keyof T])] as const
    }),
  )

  const aggregated = entries.reduce<IValidationResult<Partial<T>>>(
    (accumulator, [key, result]) => {
      if (result.success) {
        accumulator.data = { ...(accumulator.data ?? {}), [key]: result.data } as Partial<T>
        return accumulator
      }

      accumulator.success = false
      accumulator.errors = {
        ...(accumulator.errors ?? {}),
        ...Object.entries(result.errors ?? {}).reduce<Record<string, string[]>>((mapped, [field, messages]) => {
          mapped[`${key}.${field}`] = messages
          return mapped
        }, {}),
      }
      return accumulator
    },
    { success: true, data: {} as Partial<T> },
  )

  return aggregated
}
