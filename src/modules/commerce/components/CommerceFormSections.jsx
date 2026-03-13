import { useEffect, useRef } from 'react'

import { formatCurrencyBRL, getChannelLabel, getPaymentMethodLabel } from '../../../services/commerce'

export function CommerceIdentitySection({
  eyebrow,
  title,
  channelId,
  channelLabel = 'Canal',
  channelField,
  channelValue,
  channelOptions,
  customerFieldId,
  customerValue,
  customers,
  paymentId,
  paymentValue,
  paymentOptions,
  onFieldChange,
  onCustomerChange,
}) {
  return (
    <div className="entity-form-section commerce-panel commerce-panel--identity">
      <div className="entity-form-section__header">
        <span className="entity-form-section__eyebrow">{eyebrow}</span>
        <p className="entity-form-section__title">{title}</p>
      </div>

      <div className="entity-stack">
        <div className="ui-field">
          <label className="ui-label" htmlFor={channelId}>
            {channelLabel}
          </label>
          <select
            id={channelId}
            className="ui-select"
            value={channelValue}
            onChange={(event) => onFieldChange(channelField, event.target.value)}
          >
            {channelOptions.map((channel) => (
              <option key={channel} value={channel}>
                {getChannelLabel(channel)}
              </option>
            ))}
          </select>
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={customerFieldId}>
            Cliente
          </label>
          <select
            id={customerFieldId}
            className="ui-select"
            value={customerValue}
            onChange={(event) => onCustomerChange(event.target.value)}
          >
            <option value="">Cliente avulso</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={paymentId}>
            Forma de pagamento
          </label>
          <select
            id={paymentId}
            className="ui-select"
            value={paymentValue}
            onChange={(event) => onFieldChange('paymentMethod', event.target.value)}
          >
            {paymentOptions.map((paymentMethod) => (
              <option key={paymentMethod} value={paymentMethod}>
                {getPaymentMethodLabel(paymentMethod)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

export function CommerceItemsSection(props) {
  return <CommerceItemsStep {...props} />
}

export function CommerceItemsStep({
  eyebrow,
  title,
  items,
  products,
  draftItems,
  onItemChange,
  onRemoveItem,
  onAddItem,
  onAdvance,
  hasValidItems,
  subtotal,
}) {
  const productRefs = useRef([])
  const pendingFocusIndex = useRef(null)
  const didInitialFocus = useRef(false)
  const validItems = draftItems
    .map((item, index) => ({ ...item, itemIndex: index }))
    .filter((item) => item.productId)

  useEffect(() => {
    if (!didInitialFocus.current) {
      productRefs.current[0]?.focus()
      didInitialFocus.current = true
    }
  }, [])

  useEffect(() => {
    if (pendingFocusIndex.current == null) {
      return
    }

    const nextIndex = pendingFocusIndex.current
    const nextFrame = window.requestAnimationFrame(() => {
      productRefs.current[nextIndex]?.focus()
      pendingFocusIndex.current = null
    })

    return () => window.cancelAnimationFrame(nextFrame)
  }, [items.length])

  function handleAddRow() {
    const lastIndex = Math.max(items.length - 1, 0)
    const lastItem = items[lastIndex] ?? {}
    const hasValidLastItem = Boolean(lastItem.productId && Number(lastItem.unitPrice) > 0)

    if (hasValidLastItem) {
      pendingFocusIndex.current = items.length
      onAddItem()
      return
    }

    pendingFocusIndex.current = lastIndex
    productRefs.current[lastIndex]?.focus()
  }

  return (
    <section className="commerce-step commerce-step--items">
      <div className="entity-form-section commerce-panel commerce-panel--items">
        <div className="entity-form-section__header">
          <span className="entity-form-section__eyebrow">{eyebrow}</span>
          <p className="entity-form-section__title">{title}</p>
        </div>

        <div className="commerce-step__input-row">
          <select
            ref={(element) => {
              productRefs.current[items.length - 1] = element
            }}
            className="ui-select"
            value={items[items.length - 1]?.productId ?? ''}
            onChange={(event) => onItemChange(items.length - 1, 'productId', event.target.value)}
          >
            <option value="">Produto</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>

          <input
            className="ui-input"
            type="number"
            min="1"
            step="1"
            placeholder="Qtd"
            value={items[items.length - 1]?.quantity ?? ''}
            onChange={(event) => onItemChange(items.length - 1, 'quantity', event.target.value)}
          />

          <input
            className="ui-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="Valor"
            value={items[items.length - 1]?.unitPrice ?? ''}
            onChange={(event) => onItemChange(items.length - 1, 'unitPrice', event.target.value)}
          />

          <input
            className="ui-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="Desc. %"
            value={items[items.length - 1]?.discountPercent ?? ''}
            onChange={(event) => onItemChange(items.length - 1, 'discountPercent', event.target.value)}
          />

          <div className="commerce-step__line-total">
            <span>Total</span>
            <strong>{formatCurrencyBRL(draftItems[items.length - 1]?.totalPrice ?? 0)}</strong>
          </div>

          <button type="button" className="ui-button ui-button--primary commerce-step__add-button" onClick={handleAddRow}>
            +
          </button>
        </div>
      </div>

      <div className="commerce-step__item-list">
        <div className="commerce-step__item-row commerce-step__item-row--header">
          <strong>Produto</strong>
          <strong>Qtd</strong>
          <strong>Preço unit.</strong>
          <strong>Desconto</strong>
          <strong>Total</strong>
          <span />
        </div>

        {validItems.length === 0 ? (
          <div className="commerce-step__empty">Adicione pelo menos um item para continuar.</div>
        ) : (
          validItems.map((item) => (
            <div key={`${item.productId}-${item.itemIndex}`} className="commerce-step__item-row">
              <span>{item.productSnapshot?.name ?? 'Produto'}</span>
              <span>{item.quantity}</span>
              <span>{formatCurrencyBRL(item.unitPrice)}</span>
              <span>{Number(item.discountPercent ?? 0)}%</span>
              <strong>{formatCurrencyBRL(item.totalPrice ?? 0)}</strong>
              <button
                type="button"
                className="ui-button ui-button--danger commerce-step__remove-button"
                onClick={() => onRemoveItem(item.itemIndex)}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <div className="commerce-step__footer">
        <div className="commerce-step__subtotal">Subtotal: {formatCurrencyBRL(subtotal)}</div>
        <button
          type="button"
          className="ui-button ui-button--primary"
          disabled={!hasValidItems}
          onClick={onAdvance}
        >
          Avançar →
        </button>
      </div>
    </section>
  )
}

export function CommerceAddressSection({
  eyebrow,
  title,
  itemPrefix,
  address,
  notes,
  onAddressChange,
  onFieldChange,
}) {
  return (
    <div className="entity-form-section entity-form-section--span-2 commerce-panel">
      <div className="entity-form-section__header">
        <span className="entity-form-section__eyebrow">{eyebrow}</span>
        <p className="entity-form-section__title">{title}</p>
      </div>

      <div className="entity-stack">
        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-neighborhood`}>
            Bairro
          </label>
          <input
            id={`${itemPrefix}-neighborhood`}
            className="ui-input"
            value={address.neighborhood}
            onChange={(event) => onAddressChange('neighborhood', event.target.value)}
          />
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-address`}>
            Endereço
          </label>
          <input
            id={`${itemPrefix}-address`}
            className="ui-input"
            value={address.addressLine}
            onChange={(event) => onAddressChange('addressLine', event.target.value)}
          />
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-reference`}>
            Referência
          </label>
          <input
            id={`${itemPrefix}-reference`}
            className="ui-input"
            value={address.reference}
            onChange={(event) => onAddressChange('reference', event.target.value)}
          />
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-complement`}>
            Complemento
          </label>
          <input
            id={`${itemPrefix}-complement`}
            className="ui-input"
            value={address.complement}
            onChange={(event) => onAddressChange('complement', event.target.value)}
          />
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-notes`}>
            Observações
          </label>
          <textarea
            id={`${itemPrefix}-notes`}
            className="ui-textarea"
            rows={4}
            value={notes}
            onChange={(event) => onFieldChange('notes', event.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

export function CommerceTotalsSection({
  eyebrow,
  title,
  itemPrefix,
  domainClassName,
  totals,
  calculatedTotals,
  onTotalsChange,
}) {
  return (
    <div className="entity-form-section entity-form-section--span-2 commerce-panel commerce-panel--totals">
      <div className="entity-form-section__header">
        <span className="entity-form-section__eyebrow">{eyebrow}</span>
        <p className="entity-form-section__title">{title}</p>
      </div>

      <div className={`${domainClassName}__totals-grid`}>
        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-freight`}>
            Frete
          </label>
          <input
            id={`${itemPrefix}-freight`}
            className="ui-input"
            type="number"
            min="0"
            step="0.01"
            value={totals.freight}
            onChange={(event) => onTotalsChange('freight', event.target.value)}
          />
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-extra`}>
            Adicional
          </label>
          <input
            id={`${itemPrefix}-extra`}
            className="ui-input"
            type="number"
            min="0"
            step="0.01"
            value={totals.extraAmount}
            onChange={(event) => onTotalsChange('extraAmount', event.target.value)}
          />
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-discount-percent`}>
            Desconto (%)
          </label>
          <input
            id={`${itemPrefix}-discount-percent`}
            className="ui-input"
            type="number"
            min="0"
            step="0.01"
            value={totals.discountPercent}
            onChange={(event) => onTotalsChange('discountPercent', event.target.value)}
          />
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-discount-value`}>
            Desconto (R$)
          </label>
          <input
            id={`${itemPrefix}-discount-value`}
            className="ui-input"
            type="number"
            min="0"
            step="0.01"
            value={totals.discountValue}
            onChange={(event) => onTotalsChange('discountValue', event.target.value)}
          />
        </div>
      </div>

      <div className={`${domainClassName}__summary`}>
        <div className={`${domainClassName}__summary-row`}>
          <span>Subtotal</span>
          <strong>{formatCurrencyBRL(calculatedTotals.subtotal)}</strong>
        </div>
        <div className={`${domainClassName}__summary-row`}>
          <span>Frete</span>
          <strong>{formatCurrencyBRL(calculatedTotals.freight)}</strong>
        </div>
        <div className={`${domainClassName}__summary-row`}>
          <span>Adicional</span>
          <strong>{formatCurrencyBRL(calculatedTotals.extraAmount)}</strong>
        </div>
        <div className={`${domainClassName}__summary-row`}>
          <span>Desconto</span>
          <strong>{formatCurrencyBRL(calculatedTotals.discountValue)}</strong>
        </div>
        <div className={`${domainClassName}__summary-row ${domainClassName}__summary-row--total`}>
          <span>Total final</span>
          <strong>{formatCurrencyBRL(calculatedTotals.total)}</strong>
        </div>
      </div>
    </div>
  )
}

export function CommerceFinishStep({
  identityProps,
  addressProps,
  totalsProps,
  summaryItems,
  totalFinal,
}) {
  return (
    <section className="commerce-step commerce-step--finish">
      <div className="commerce-step__finish-grid">
        <div className="entity-stack">
          <CommerceIdentitySection {...identityProps} />
          <CommerceAddressSection {...addressProps} />
        </div>

        <div className="entity-stack">
          <CommerceTotalsSection {...totalsProps} />

          <div className="entity-form-section commerce-panel commerce-panel--summary">
            <div className="entity-form-section__header">
              <span className="entity-form-section__eyebrow">Resumo</span>
              <p className="entity-form-section__title">Itens da operação</p>
            </div>

            <div className="entity-stack">
              {summaryItems.map((item) => (
                <div key={`${item.productId}-${item.itemIndex}`} className="commerce-step__summary-item">
                  <span>{item.name}</span>
                  <span>
                    {item.quantity} × {formatCurrencyBRL(item.unitPrice)}
                  </span>
                  <strong>{formatCurrencyBRL(item.totalPrice)}</strong>
                </div>
              ))}

              <div className="commerce-step__total-final">
                <span>Total final</span>
                <strong>{formatCurrencyBRL(totalFinal)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
