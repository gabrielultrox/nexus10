import type { IFormFieldProps } from './types'

function FormField({
  label,
  hint,
  error,
  required = false,
  htmlFor,
  children,
  className = '',
  inline = false,
  ...props
}: IFormFieldProps) {
  return (
    <div
      className={['ui-form-field', inline ? 'ui-form-field--inline' : '', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {label ? (
        <label className="ui-form-field__label" htmlFor={htmlFor}>
          <span>{label}</span>
          {required ? <span className="ui-form-field__required">*</span> : null}
        </label>
      ) : null}
      <div className="ui-form-field__control">{children}</div>
      {error ? (
        <p className="ui-form-field__message ui-form-field__message--error">{error}</p>
      ) : hint ? (
        <p className="ui-form-field__message ui-form-field__message--hint">{hint}</p>
      ) : null}
    </div>
  )
}

export default FormField
