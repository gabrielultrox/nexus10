import { forwardRef } from 'react'

import type { IInputProps } from './types'

const Input = forwardRef<HTMLInputElement, IInputProps>(function Input(
  { className = '', error = false, leftIcon = null, rightIcon = null, disabled = false, ...props },
  ref,
) {
  return (
    <span
      className={[
        'ui-form-input',
        error ? 'is-error' : '',
        disabled ? 'is-disabled' : '',
        leftIcon ? 'has-left-icon' : '',
        rightIcon ? 'has-right-icon' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {leftIcon ? (
        <span className="ui-form-input__icon ui-form-input__icon--left">{leftIcon}</span>
      ) : null}
      <input ref={ref} className="ui-input ui-form-input__element" disabled={disabled} {...props} />
      {rightIcon ? (
        <span className="ui-form-input__icon ui-form-input__icon--right">{rightIcon}</span>
      ) : null}
    </span>
  )
})

export default Input
