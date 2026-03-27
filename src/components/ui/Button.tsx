import { Children, forwardRef } from 'react'

import type { IButtonProps } from './types'

const Button = forwardRef<HTMLButtonElement, IButtonProps>(function Button(
  { children, className = '', variant = 'primary', type = 'button', disabled = false, ...props },
  ref,
) {
  const classes = ['ui-button', `ui-button--${variant}`, className].filter(Boolean).join(' ')
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
      disabled={disabled}
      aria-label={accessibleLabel}
      data-icon-only={!hasVisibleText || undefined}
      {...props}
    >
      {children}
    </button>
  )
})

export default Button
