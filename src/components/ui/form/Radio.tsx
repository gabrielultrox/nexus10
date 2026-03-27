import { forwardRef } from 'react'

import type { IRadioGroupProps, IRadioProps } from './types'

const Radio = forwardRef<HTMLInputElement, IRadioProps>(function Radio(
  { className = '', label, description, disabled = false, id, ...props },
  ref,
) {
  return (
    <label
      className={['ui-radio', disabled ? 'is-disabled' : '', className].filter(Boolean).join(' ')}
    >
      <input
        {...props}
        id={id}
        ref={ref}
        className="ui-radio__input"
        type="radio"
        disabled={disabled}
      />
      <span className="ui-radio__indicator" aria-hidden="true" />
      {label || description ? (
        <span className="ui-radio__copy">
          {label ? <span className="ui-radio__label">{label}</span> : null}
          {description ? <span className="ui-radio__description">{description}</span> : null}
        </span>
      ) : null}
    </label>
  )
})

export function RadioGroup({
  name,
  value,
  onChange,
  options,
  disabled = false,
  className = '',
  ...props
}: IRadioGroupProps) {
  return (
    <div
      className={['ui-radio-group', className].filter(Boolean).join(' ')}
      role="radiogroup"
      {...props}
    >
      {options.map((option) => (
        <Radio
          key={`${name}-${option.value}`}
          name={name}
          label={option.label}
          description={option.description}
          value={option.value}
          checked={value === option.value}
          disabled={disabled || option.disabled}
          onChange={() => onChange(option.value)}
        />
      ))}
    </div>
  )
}

export default Radio
