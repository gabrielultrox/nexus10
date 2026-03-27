import { forwardRef } from 'react'

import type { ITextareaProps } from './types'

const Textarea = forwardRef<HTMLTextAreaElement, ITextareaProps>(function Textarea(
  {
    className = '',
    error = false,
    resize = 'vertical',
    showCounter = false,
    maxLength,
    value,
    defaultValue,
    disabled = false,
    ...props
  },
  ref,
) {
  const currentLength = String(value ?? defaultValue ?? '').length

  return (
    <div
      className={['ui-form-textarea', error ? 'is-error' : '', className].filter(Boolean).join(' ')}
    >
      <textarea
        ref={ref}
        className="ui-textarea ui-form-textarea__element"
        disabled={disabled}
        maxLength={maxLength}
        style={{ resize }}
        value={value}
        defaultValue={defaultValue}
        {...props}
      />
      {showCounter && maxLength ? (
        <span className="ui-form-textarea__counter">
          {currentLength}/{maxLength}
        </span>
      ) : null}
    </div>
  )
})

export default Textarea
