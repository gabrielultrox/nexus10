import { forwardRef } from 'react'

const CHEVRON_ICON = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4 6.5L8 10L12 6.5" />
  </svg>
)

const Select = forwardRef(function Select(
  { className = '', children, disabled = false, ...props },
  ref,
) {
  const composedClassName = className.includes('ui-select')
    ? className
    : ['ui-select', className].filter(Boolean).join(' ')

  return (
    <span className={`ui-select-shell${disabled ? ' is-disabled' : ''}`}>
      <select ref={ref} className={composedClassName} disabled={disabled} {...props}>
        {children}
      </select>
      <span className="ui-select-shell__icon">{CHEVRON_ICON}</span>
    </span>
  )
})

export default Select
