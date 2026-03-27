export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  OFFLINE_ERROR = 'OFFLINE_ERROR',
  SYNC_ERROR = 'SYNC_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface IErrorContext {
  feature?: string
  action?: string
  userId?: string
  [key: string]: unknown
}

export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly status: number
  public readonly severity: ErrorSeverity
  public readonly details?: unknown
  public readonly timestamp: string
  public readonly context?: IErrorContext

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
    status = 500,
    severity: ErrorSeverity = ErrorSeverity.HIGH,
    details?: unknown,
    context?: IErrorContext,
  ) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.status = status
    this.severity = severity
    this.details = details
    this.context = context
    this.timestamp = new Date().toISOString()
    Object.setPrototypeOf(this, new.target.prototype)
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      severity: this.severity,
      details: this.details,
      timestamp: this.timestamp,
      context: this.context,
    }
  }

  override toString() {
    return `[${this.code}] ${this.message}`
  }

  log() {
    const payload = this.toJSON()

    if (this.severity === ErrorSeverity.CRITICAL || this.severity === ErrorSeverity.HIGH) {
      console.error(payload)
      return
    }

    if (this.severity === ErrorSeverity.MEDIUM) {
      console.warn(payload)
      return
    }

    console.info(payload)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown, context?: IErrorContext) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, ErrorSeverity.LOW, details, context)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Nao autenticado.', details?: unknown, context?: IErrorContext) {
    super(message, ErrorCode.UNAUTHORIZED, 401, ErrorSeverity.MEDIUM, details, context)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado.', details?: unknown, context?: IErrorContext) {
    super(message, ErrorCode.FORBIDDEN, 403, ErrorSeverity.MEDIUM, details, context)
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Falha de rede.', details?: unknown, context?: IErrorContext) {
    super(message, ErrorCode.NETWORK_ERROR, 0, ErrorSeverity.HIGH, details, context)
  }
}

export class TimeoutError extends AppError {
  constructor(message = 'Tempo limite excedido.', details?: unknown, context?: IErrorContext) {
    super(message, ErrorCode.TIMEOUT_ERROR, 408, ErrorSeverity.HIGH, details, context)
  }
}

export class SyncError extends AppError {
  constructor(message = 'Falha de sincronizacao.', details?: unknown, context?: IErrorContext) {
    super(message, ErrorCode.SYNC_ERROR, 0, ErrorSeverity.HIGH, details, context)
  }
}

export class ErrorHandler {
  static normalize(error: unknown): AppError {
    if (error instanceof AppError) {
      return error
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      return new TimeoutError('A requisicao excedeu o tempo limite.', error)
    }

    if (error instanceof Error) {
      return new AppError(
        error.message || 'Erro interno inesperado.',
        ErrorCode.INTERNAL_SERVER_ERROR,
        500,
        ErrorSeverity.HIGH,
        { cause: error.name },
      )
    }

    return new AppError(
      'Erro interno inesperado.',
      ErrorCode.INTERNAL_SERVER_ERROR,
      500,
      ErrorSeverity.HIGH,
      error,
    )
  }

  static isRecoverable(error: unknown): boolean {
    const normalized = this.normalize(error)

    return [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT_ERROR,
      ErrorCode.SERVICE_UNAVAILABLE,
      ErrorCode.SYNC_ERROR,
    ].includes(normalized.code)
  }

  static getUserMessage(error: unknown): string {
    const normalized = this.normalize(error)

    const map: Record<ErrorCode, string> = {
      [ErrorCode.VALIDATION_ERROR]:
        'Alguns dados informados sao invalidos. Revise os campos e tente novamente.',
      [ErrorCode.UNAUTHORIZED]: 'Sua sessao expirou. Entre novamente para continuar.',
      [ErrorCode.FORBIDDEN]: 'Seu perfil nao tem permissao para executar esta acao.',
      [ErrorCode.NOT_FOUND]: 'O recurso solicitado nao foi encontrado.',
      [ErrorCode.CONFLICT]:
        'Nao foi possivel concluir a operacao porque os dados entraram em conflito.',
      [ErrorCode.INTERNAL_SERVER_ERROR]: 'Ocorreu um erro interno. Tente novamente em instantes.',
      [ErrorCode.SERVICE_UNAVAILABLE]:
        'O servico esta indisponivel no momento. Tente novamente em instantes.',
      [ErrorCode.NETWORK_ERROR]: 'Sem conexao com o servidor. Verifique a rede e tente novamente.',
      [ErrorCode.TIMEOUT_ERROR]: 'A operacao demorou demais para responder. Tente novamente.',
      [ErrorCode.OFFLINE_ERROR]: 'Voce esta offline. Assim que a conexao voltar, tente novamente.',
      [ErrorCode.SYNC_ERROR]: 'Nao foi possivel sincronizar os dados agora. Tentaremos novamente.',
      [ErrorCode.CACHE_ERROR]: 'Houve uma falha ao acessar os dados locais do dispositivo.',
    }

    return map[normalized.code] ?? normalized.message
  }
}
