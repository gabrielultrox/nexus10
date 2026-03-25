import { describe, expect, it, vi } from 'vitest'

import {
  AppError,
  ErrorCode,
  ErrorHandler,
  ErrorSeverity,
  NetworkError,
  ValidationError,
} from '../../services/errorHandler'

describe('Error Handler', () => {
  it('creates AppError with default values', () => {
    const error = new AppError('Falha padrao')

    expect(error.message).toBe('Falha padrao')
    expect(error.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR)
    expect(error.status).toBe(500)
    expect(error.severity).toBe(ErrorSeverity.HIGH)
  })

  it('creates AppError with custom values', () => {
    const error = new AppError(
      'Falha customizada',
      ErrorCode.CONFLICT,
      409,
      ErrorSeverity.MEDIUM,
      { resource: 'order' },
      { feature: 'orders' },
    )

    expect(error.code).toBe(ErrorCode.CONFLICT)
    expect(error.status).toBe(409)
    expect(error.severity).toBe(ErrorSeverity.MEDIUM)
    expect(error.details).toEqual({ resource: 'order' })
    expect(error.context).toEqual({ feature: 'orders' })
  })

  it('serializes AppError to JSON', () => {
    const error = new AppError('Serializar', ErrorCode.CACHE_ERROR, 500, ErrorSeverity.LOW)

    expect(error.toJSON()).toMatchObject({
      name: 'AppError',
      message: 'Serializar',
      code: ErrorCode.CACHE_ERROR,
      status: 500,
      severity: ErrorSeverity.LOW,
    })
  })

  it('creates ValidationError with expected defaults', () => {
    const error = new ValidationError('Campo invalido')

    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR)
    expect(error.status).toBe(400)
    expect(error.severity).toBe(ErrorSeverity.LOW)
  })

  it('creates NetworkError with expected defaults', () => {
    const error = new NetworkError()

    expect(error.code).toBe(ErrorCode.NETWORK_ERROR)
    expect(error.status).toBe(0)
    expect(error.severity).toBe(ErrorSeverity.HIGH)
  })

  it('normalizes unknown errors', () => {
    const normalized = ErrorHandler.normalize(new Error('Erro bruto'))

    expect(normalized).toBeInstanceOf(AppError)
    expect(normalized.message).toBe('Erro bruto')
    expect(normalized.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR)
  })

  it('identifies recoverable errors', () => {
    expect(ErrorHandler.isRecoverable(new NetworkError())).toBe(true)
    expect(ErrorHandler.isRecoverable(new ValidationError('Erro de campo'))).toBe(false)
  })

  it('returns user-friendly messages', () => {
    expect(ErrorHandler.getUserMessage(new ValidationError('Campo invalido'))).toContain('dados informados')
    expect(ErrorHandler.getUserMessage(new NetworkError())).toContain('Sem conexao')
  })

  it('logs according to severity', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    new AppError('Alta', ErrorCode.INTERNAL_SERVER_ERROR, 500, ErrorSeverity.HIGH).log()
    new AppError('Media', ErrorCode.CONFLICT, 409, ErrorSeverity.MEDIUM).log()
    new AppError('Baixa', ErrorCode.CACHE_ERROR, 500, ErrorSeverity.LOW).log()

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1)
  })
})
