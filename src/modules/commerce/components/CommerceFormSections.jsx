import { formatCurrencyBRL, getChannelLabel, getPaymentMethodLabel } from '../../../services/commerce';

export function CommerceFormSignalBar({ eyebrow, title, description, badges = [] }) {
  return (
    <section className="commerce-signal-bar">
      <div className="commerce-signal-bar__copy">
        <span className="commerce-signal-bar__eyebrow">{eyebrow}</span>
        <h3 className="commerce-signal-bar__title">{title}</h3>
        <p className="commerce-signal-bar__description">{description}</p>
      </div>

      <div className="commerce-signal-bar__badges">
        {badges.map((badge) => (
          <span key={`${badge.label}-${badge.tone ?? 'info'}`} className={`ui-badge ${badge.tone ?? 'ui-badge--info'}`}>
            {badge.label}
          </span>
        ))}
      </div>
    </section>
  );
}

export function CommerceIdentitySection({
  eyebrow,
  title,
  description,
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
        <h4 className="entity-form-section__title">{title}</h4>
        <p className="entity-form-section__description">{description}</p>
      </div>

      <div className="entity-stack">
        <div className="ui-field">
          <label className="ui-label" htmlFor={channelId}>{channelLabel}</label>
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
          <label className="ui-label" htmlFor={customerFieldId}>Cliente</label>
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
          <label className="ui-label" htmlFor={paymentId}>Forma de pagamento</label>
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
  );
}

export function CommerceItemsSection({
  eyebrow,
  title,
  description,
  items,
  products,
  draftItems,
  itemPrefix,
  domainClassName,
  onItemChange,
  onRemoveItem,
  onAddItem,
}) {
  return (
    <div className="entity-form-section entity-form-section--span-2 commerce-panel commerce-panel--items">
      <div className="entity-form-section__header">
        <span className="entity-form-section__eyebrow">{eyebrow}</span>
        <h4 className="entity-form-section__title">{title}</h4>
        <p className="entity-form-section__description">{description}</p>
      </div>

      <div className={`${domainClassName}__items`}>
        {items.map((item, index) => (
          <div key={`${item.productId || 'novo'}-${index}`} className={`${domainClassName}__item-row`}>
            <div className="ui-field">
              <label className="ui-label" htmlFor={`${itemPrefix}-item-product-${index}`}>Produto</label>
              <select
                id={`${itemPrefix}-item-product-${index}`}
                className="ui-select"
                value={item.productId}
                onChange={(event) => onItemChange(index, 'productId', event.target.value)}
              >
                <option value="">Selecione</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor={`${itemPrefix}-item-quantity-${index}`}>Quantidade</label>
              <input
                id={`${itemPrefix}-item-quantity-${index}`}
                className="ui-input"
                type="number"
                min="1"
                step="1"
                value={item.quantity}
                onChange={(event) => onItemChange(index, 'quantity', event.target.value)}
              />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor={`${itemPrefix}-item-price-${index}`}>Preco unitario</label>
              <input
                id={`${itemPrefix}-item-price-${index}`}
                className="ui-input"
                type="number"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={(event) => onItemChange(index, 'unitPrice', event.target.value)}
              />
            </div>

            <div className={`${domainClassName}__item-total`}>
              <span className={`${domainClassName}__item-total-label`}>Total do item</span>
              <strong>{formatCurrencyBRL(draftItems[index]?.totalPrice ?? 0)}</strong>
            </div>

            <button
              type="button"
              className="ui-button ui-button--danger"
              onClick={() => onRemoveItem(index)}
              disabled={items.length === 1}
            >
              Remover
            </button>
          </div>
        ))}

        <button type="button" className="ui-button ui-button--ghost commerce-panel__add-button" onClick={onAddItem}>
          Adicionar item
        </button>
      </div>
    </div>
  );
}

export function CommerceAddressSection({
  eyebrow,
  title,
  description,
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
        <h4 className="entity-form-section__title">{title}</h4>
        <p className="entity-form-section__description">{description}</p>
      </div>

      <div className="entity-stack">
        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-neighborhood`}>Bairro</label>
          <input
            id={`${itemPrefix}-neighborhood`}
            className="ui-input"
            value={address.neighborhood}
            onChange={(event) => onAddressChange('neighborhood', event.target.value)}
          />
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-address`}>Endereco</label>
          <input
            id={`${itemPrefix}-address`}
            className="ui-input"
            value={address.addressLine}
            onChange={(event) => onAddressChange('addressLine', event.target.value)}
          />
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-reference`}>Referencia</label>
          <input
            id={`${itemPrefix}-reference`}
            className="ui-input"
            value={address.reference}
            onChange={(event) => onAddressChange('reference', event.target.value)}
          />
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-complement`}>Complemento</label>
          <input
            id={`${itemPrefix}-complement`}
            className="ui-input"
            value={address.complement}
            onChange={(event) => onAddressChange('complement', event.target.value)}
          />
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-notes`}>Observacoes</label>
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
  );
}

export function CommerceTotalsSection({
  eyebrow,
  title,
  description,
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
        <h4 className="entity-form-section__title">{title}</h4>
        <p className="entity-form-section__description">{description}</p>
      </div>

      <div className={`${domainClassName}__totals-grid`}>
        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-freight`}>Frete</label>
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
          <label className="ui-label" htmlFor={`${itemPrefix}-extra`}>Adicional</label>
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
          <label className="ui-label" htmlFor={`${itemPrefix}-discount-percent`}>Desconto (%)</label>
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
          <label className="ui-label" htmlFor={`${itemPrefix}-discount-value`}>Desconto (R$)</label>
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
  );
}
