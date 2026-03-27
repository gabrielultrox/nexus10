function Toggle({
  id,
  checked = false,
  onChange,
  label,
  disabled = false,
  tabIndex,
  className = '',
}) {
  return (
    <label
      className={[
        'ui-toggle',
        checked ? 'ui-toggle--checked' : '',
        disabled ? 'ui-toggle--disabled' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      htmlFor={id}
    >
      <input
        id={id}
        className="ui-toggle__input"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        tabIndex={tabIndex}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <span className="ui-toggle__track" aria-hidden="true">
        <span className="ui-toggle__thumb" />
      </span>
      {label ? <span className="ui-toggle__label">{label}</span> : null}
    </label>
  )
}

export default Toggle
