import { useEffect, useRef } from 'react'

import SurfaceCard from '../../../components/common/SurfaceCard'
import FormRow from '../../../components/ui/FormRow'
import Select from '../../../components/ui/Select'
import Toggle from '../../../components/ui/Toggle'
import { Button, Checkbox, Input, Textarea } from '../../../components/ui'

function NativeModuleField({ field, routePath, value, updateField }) {
  if (field.type === 'checkbox') {
    if (routePath === 'delivery-reading') {
      return (
        <Checkbox
          id={`${routePath}-${field.name}`}
          className="native-module__inline-toggle"
          checked={Boolean(value)}
          label={field.label}
          onChange={(event) => updateField(field.name, event.target.checked)}
        />
      )
    }

    return (
      <Checkbox
        id={`${routePath}-${field.name}`}
        className="native-module__checkbox"
        checked={Boolean(value)}
        label={<strong>{field.label}</strong>}
        description={field.description ?? 'Marque esta opcao quando ela se aplicar ao registro.'}
        onChange={(event) => updateField(field.name, event.target.checked)}
      />
    )
  }

  if (routePath === 'delivery-reading') {
    if (field.type === 'select') {
      return (
        <Select
          id={`${routePath}-${field.name}`}
          className="ui-select"
          aria-label={field.label}
          value={value ?? ''}
          required={field.required !== false}
          onChange={(event) => updateField(field.name, event.target.value)}
        >
          {field.options.map((option) => (
            <option key={`${routePath}-${field.name}-${option}`} value={option}>
              {option}
            </option>
          ))}
        </Select>
      )
    }

    return (
      <Input
        id={`${routePath}-${field.name}`}
        aria-label={field.label}
        type={field.type ?? 'text'}
        value={value ?? ''}
        placeholder={field.placeholder ?? field.label}
        required={field.required !== false}
        onChange={(event) => updateField(field.name, event.target.value)}
      />
    )
  }

  return (
    <>
      <label className="ui-label" htmlFor={`${routePath}-${field.name}`}>
        {field.label}
      </label>

      {field.type === 'select' ? (
        <Select
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
        </Select>
      ) : field.type === 'textarea' ? (
        <Textarea
          id={`${routePath}-${field.name}`}
          value={value ?? ''}
          placeholder={field.placeholder}
          rows={4}
          required={field.required !== false}
          onChange={(event) => updateField(field.name, event.target.value)}
        />
      ) : (
        <Input
          id={`${routePath}-${field.name}`}
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
  isSubmitting = false,
  focusFieldKey = 0,
  invalidFieldName = '',
  noticeMessage = '',
  submitDisabledReason = '',
  secondaryAction = null,
}) {
  const formRef = useRef(null)
  const deliveryCodeInputRef = useRef(null)

  useEffect(() => {
    if (routePath === 'delivery-reading') {
      deliveryCodeInputRef.current?.focus()
      return
    }

    if (!formRef.current) {
      return
    }

    const firstField = formRef.current.querySelector(
      'input:not([type="checkbox"]), select, textarea',
    )
    firstField?.focus()
  }, [focusFieldKey, routePath])

  useEffect(() => {
    if (routePath !== 'delivery-reading') {
      return
    }

    deliveryCodeInputRef.current?.focus()
  }, [focusFieldKey, routePath])

  if (!managerWithResolvedFields || managerWithResolvedFields.hideForm) {
    return null
  }

  if (routePath === 'delivery-reading') {
    const codeValue = formValues.deliveryCode ?? ''
    const courierField = managerWithResolvedFields.fields.find((field) => field.name === 'courier')

    return (
      <SurfaceCard title={manager.formTitle}>
        <div className="native-module__form-shell">
          <div className="native-module__form-copy">
            <span className="ui-badge ui-badge--info">{recordsLength} registros do dia</span>
          </div>

          {noticeMessage ? (
            <div className="native-module__inline-guardrail" role="status">
              {noticeMessage}
            </div>
          ) : null}

          <form
            className="native-module__delivery-form"
            onSubmit={onSubmit}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                onReset()
                return
              }

              if (
                event.key === 'Enter' &&
                event.target instanceof HTMLElement &&
                event.target.tagName !== 'BUTTON'
              ) {
                event.preventDefault()
                event.currentTarget.requestSubmit()
              }
            }}
          >
            <FormRow className="native-module__delivery-form-row">
              <Input
                ref={deliveryCodeInputRef}
                id="delivery-reading-deliveryCode"
                className={`native-module__delivery-code-input${invalidFieldName === 'deliveryCode' ? ' is-invalid' : ''}`}
                type="text"
                inputMode="numeric"
                aria-label="Codigo"
                value={codeValue}
                placeholder="Codigo ex: 10452"
                onChange={(event) => updateField('deliveryCode', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && codeValue.trim()) {
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
              />

              <Select
                id="delivery-reading-courier"
                className="ui-select native-module__delivery-courier-select"
                aria-label="Entregador"
                value={formValues.courier ?? ''}
                onChange={(event) => updateField('courier', event.target.value)}
              >
                {(courierField?.options ?? []).map((option) => (
                  <option key={`delivery-reading-courier-${option}`} value={option}>
                    {option}
                  </option>
                ))}
              </Select>

              <Toggle
                id="delivery-reading-turbo"
                label="Turbo"
                checked={Boolean(formValues.turbo)}
                tabIndex={-1}
                onChange={(checked) => updateField('turbo', checked)}
              />

              <Toggle
                id="delivery-reading-closed"
                label="Fechada"
                checked={Boolean(formValues.closed)}
                tabIndex={-1}
                onChange={(checked) => updateField('closed', checked)}
              />

              <Button
                type="submit"
                className="native-module__delivery-submit"
                disabled={
                  isSubmitting || codeValue.trim().length === 0 || Boolean(submitDisabledReason)
                }
                title={submitDisabledReason || undefined}
                variant="primary"
              >
                {isSubmitting ? (
                  <>
                    <span className="native-module__button-spinner" aria-hidden="true" />
                    <span>Registrando...</span>
                  </>
                ) : (
                  manager.submitLabel
                )}
              </Button>
            </FormRow>
          </form>
        </div>
      </SurfaceCard>
    )
  }

  return (
    <SurfaceCard title={manager.formTitle}>
      <div className="native-module__form-shell">
        <div className="native-module__form-copy">
          <span className="ui-badge ui-badge--info">{recordsLength} registros do dia</span>
        </div>

        {noticeMessage ? (
          <div className="native-module__inline-guardrail" role="status">
            {noticeMessage}
          </div>
        ) : null}

        <form
          ref={formRef}
          className={`native-module__form-grid${routePath === 'advances' ? ' native-module__form-grid--advances' : ''}${routePath === 'delivery-reading' ? ' native-module__form-grid--delivery-reading' : ''}`}
          onSubmit={onSubmit}
        >
          {managerWithResolvedFields.fields.map((field) => (
            <div
              key={`${routePath}-${field.name}`}
              className={`ui-field${field.type === 'checkbox' ? ' ui-field--compact-toggle' : ''}`}
            >
              <NativeModuleField
                field={field}
                routePath={routePath}
                value={formValues[field.name]}
                updateField={updateField}
              />
            </div>
          ))}

          <div
            className={`native-module__form-actions${routePath === 'delivery-reading' ? ' native-module__form-actions--inline' : ''}`}
          >
            {secondaryAction ? (
              <Button
                type="button"
                variant={secondaryAction.variant ?? 'ghost'}
                disabled={Boolean(secondaryAction.disabledReason) || secondaryAction.loading}
                loading={secondaryAction.loading}
                title={secondaryAction.disabledReason || undefined}
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </Button>
            ) : null}
            {routePath === 'advances' ? (
              <Button type="button" variant="ghost" onClick={onReset}>
                Cancelar
              </Button>
            ) : null}
            <Button
              type="submit"
              variant="secondary"
              disabled={Boolean(submitDisabledReason)}
              title={submitDisabledReason || undefined}
            >
              {manager.submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </SurfaceCard>
  )
}

export default NativeModuleFormCard
