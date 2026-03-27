export class RateLimitExceededError extends Error {
  constructor(message = 'Limite de requisicoes excedido.', details = {}) {
    super(message)
    this.name = 'RateLimitExceededError'
    this.code = 'RATE_LIMIT_EXCEEDED'
    this.statusCode = 429
    this.details = details
  }
}
