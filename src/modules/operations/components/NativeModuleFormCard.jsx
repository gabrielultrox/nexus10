import { useEffect, useRef } from 'react'

import SurfaceCard from '../../../components/common/SurfaceCard'

function NativeModuleField({ field, routePath, value, updateField }) {
  if (field.type === 'checkbox') {
    return (
      <label className="native-module__checkbox" htmlFor={`${routePath}-${field.name}`}>
        <input
          id={`${routePath}-${field.name}`}
          className="native-module__checkbox-input"
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => updateField(field.name, event.target.checked)}
        />
        <span className="native-module__checkbox-box" aria-hidden="true" />
        <span className="native-module__checkbox-copy">
          <strong>{field.label}</strong>
          <small>{field.description ?? 'Marque esta opcao quando ela se aplicar ao registro.'}</small>
        </span>
      </label>
    )
  }

  return (
    <>
      <label className="ui-label" htmlFor={`${routePath}-${field.name}`}>
        {field.label}
      </label>

      {field.type === 'select' ? (
        <select
          id={`${routePath}-${field.name}`}
          className="ui-select"
          value={value ?? ''}
          required={field.required !== false}
          onChange={(event) => updateField(field.name, event.target.value)}
        >
          {field.options.map((option) => (
            <option key={`${routePath}-${field.name}-${option}`} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          id={`${routePath}-${field.name}`}
          className="ui-textarea"
          value={value ?? ''}
          placeholder={field.placeholder}
          rows={4}
          required={field.required !== false}
          onChange={(event) => updateField(field.name, event.target.value)}
        />
      ) : (
        <input
          id={`${routePath}-${field.name}`}
          className="ui-input"
          type={field.type ?? 'text'}
          value={value ?? ''}
          placeholder={field.placeholder}
          required={field.required !== false}
          onChange={(event) => updateField(field.name, event.target.value)}
        />
      )}
    </>
  )
}

function NativeModuleFormCard({
  manager,
  managerWithResolvedFields,
  routePath,
  recordsLength,
  formValues,
  onSubmit,
  onReset,
  updateField,
}) {
  const formRef = useRef(null)

  useEffect(() => {
    if (!formRef.current) {
      return
    }

    const firstField = formRef.current.querySelector('input:not([type="checkbox"]), select, textarea')
    firstField?.focus()
  }, [routePath])

  if (!managerWithResolvedFields || managerWithResolvedFields.hideForm) {
    return null
  }

  return (
    <SurfaceCard title={manager.formTitle}>
      <div className="native-module__form-shell">
        <div className="native-module__form-copy">
          <span className="ui-badge ui-badge--info">{recordsLength} registros do dia</span>
        </div>

        <form
          ref={formRef}
          className={`native-module__form-grid${routePath === 'advances' ? ' native-module__form-grid--advances' : ''}`}
          onSubmit={onSubmit}
        >
          {managerWithResolvedFields.fields.map((field) => (
            <div key={`${routePath}-${field.name}`} className="ui-field">
              <NativeModuleField
                field={field}
                routePath={routePath}
                value={formValues[field.name]}
                updateField={updateField}
              />
            </div>
          ))}

          <div className="native-module__form-actions">
            {routePath === 'advances' ? (
              <button type="button" className="ui-button ui-button--ghost" onClick={onReset}>
                Cancelar
              </button>
            ) : null}
            <button type="submit" className="ui-button ui-button--secondary">
              {manager.submitLabel}
            </button>
          </div>
        </form>
      </div>
    </SurfaceCard>
  )
}

export default NativeModuleFormCard
