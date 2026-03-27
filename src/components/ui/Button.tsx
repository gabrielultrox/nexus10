import { forwardRef } from 'react'

import type { IButtonProps } from './types'

const Button = forwardRef<HTMLButtonElement, IButtonProps>(function Button(
  { children, className = '', variant = 'primary', type = 'button', disabled = false, ...props },
  ref,
) {
  const classes = ['ui-button', `ui-button--${variant}`, className].filter(Boolean).join(' ')

  return (
    <button ref={ref} type={type} className={classes} disabled={disabled} {...props}>
      {children}
    </button>
  )
})

export default Button
