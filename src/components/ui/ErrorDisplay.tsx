import type { ReactNode } from 'react'

import Button from './Button'

export interface IErrorDisplayProps {
  code?: string
  title?: ReactNode
  message: ReactNode
  suggestion?: ReactNode
  variant?: 'error' | 'warning'
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
}

function ErrorDisplay({
  code = 'ERR_999',
  title = 'Algo saiu do esperado',
  message,
  suggestion,
  variant = 'error',
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: IErrorDisplayProps) {
  return (
    <section
      className={`ui-error-display ui-error-display--${variant}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="ui-error-display__icon" aria-hidden="true">
        {variant === 'warning' ? '!' : 'x'}
      </div>
      <div className="ui-error-display__content">
        <div className="ui-error-display__meta">
          <span className="ui-error-display__code">{code}</span>
        </div>
        <h3 className="ui-error-display__title">{title}</h3>
        <p className="ui-error-display__message">{message}</p>
        {suggestion ? <p className="ui-error-display__suggestion">{suggestion}</p> : null}
        {actionLabel || secondaryActionLabel ? (
          <div className="ui-error-display__actions">
            {actionLabel && onAction ? (
              <Button variant="secondary" onClick={onAction}>
                {actionLabel}
              </Button>
            ) : null}
            {secondaryActionLabel && onSecondaryAction ? (
              <Button variant="ghost" onClick={onSecondaryAction}>
                {secondaryActionLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default ErrorDisplay
