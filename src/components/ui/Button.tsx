import { Children, forwardRef } from 'react'

import LoadingSpinner from './LoadingSpinner'
import type { IButtonProps } from './types'

const Button = forwardRef<HTMLButtonElement, IButtonProps>(function Button(
  {
    children,
    className = '',
    variant = 'primary',
    type = 'button',
    disabled = false,
    loading = false,
    loadingLabel = 'Carregando',
    ...props
  },
  ref,
) {
  const classes = ['ui-button', `ui-button--${variant}`, loading ? 'is-loading' : '', className]
    .filter(Boolean)
    .join(' ')
  const hasVisibleText = Children.toArray(children).some(
    (child) => typeof child === 'string' || typeof child === 'number',
  )
  const accessibleLabel =
    props['aria-label'] ??
    (!hasVisibleText && typeof props.title === 'string' ? props.title : undefined)

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-label={accessibleLabel}
      aria-busy={loading || undefined}
      data-icon-only={!hasVisibleText || undefined}
      {...props}
    >
      {loading ? <LoadingSpinner size="sm" color="inherit" label={loadingLabel} /> : null}
      {children}
    </button>
  )
})

export default Button
