import { forwardRef, useEffect, useRef } from 'react'

import type { ICheckboxGroupProps, ICheckboxProps } from './types'

const Checkbox = forwardRef<HTMLInputElement, ICheckboxProps>(function Checkbox(
  { className = '', label, description, indeterminate = false, disabled = false, id, ...props },
  ref,
) {
  const innerRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (innerRef.current) {
      innerRef.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <label
      className={['ui-checkbox', disabled ? 'is-disabled' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        {...props}
        id={id}
        ref={(node) => {
          innerRef.current = node
          if (typeof ref === 'function') {
            ref(node)
          } else if (ref) {
            ref.current = node
          }
        }}
        className="ui-checkbox__input"
        type="checkbox"
        disabled={disabled}
      />
      <span className="ui-checkbox__indicator" aria-hidden="true" />
      {label || description ? (
        <span className="ui-checkbox__copy">
          {label ? <span className="ui-checkbox__label">{label}</span> : null}
          {description ? <span className="ui-checkbox__description">{description}</span> : null}
        </span>
      ) : null}
    </label>
  )
})

export function CheckboxGroup({
  name,
  options,
  value,
  onChange,
  disabled = false,
  className = '',
  ...props
}: ICheckboxGroupProps) {
  return (
    <div className={['ui-checkbox-group', className].filter(Boolean).join(' ')} {...props}>
      {options.map((option) => (
        <Checkbox
          key={`${name}-${option.value}`}
          name={name}
          label={option.label}
          description={option.description}
          checked={value.includes(option.value)}
          disabled={disabled || option.disabled}
          onChange={(event) => {
            if (event.target.checked) {
              onChange([...value, option.value])
              return
            }

            onChange(value.filter((item) => item !== option.value))
          }}
        />
      ))}
    </div>
  )
}

export default Checkbox
