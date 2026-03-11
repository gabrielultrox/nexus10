import { formatCurrencyBRL, getChannelLabel, getPaymentMethodLabel } from '../../../services/commerce';

function OrderFormPanel({
  canWrite,
  editingOrderId,
  customers,
  products,
  formState,
  saving,
  draftItems,
  calculatedTotals,
  sourceOptions,
  paymentOptions,
  onCancel,
  onSubmit,
  onCustomerChange,
  onFieldChange,
  onAddressChange,
  onTotalsChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
}) {
  return (
    <div className="orders-domain__detail-shell">
      <div className="orders-domain__detail-header">
        <div>
          <p className="text-section-title">{editingOrderId ? 'Editar Pedido' : 'Novo Pedido'}</p>
          <p className="text-body">
            Registre itens, cliente, pagamento e entrega sem gerar impacto em estoque ou financeiro.
          </p>
        </div>
      </div>

      <form className="entity-form-grid" onSubmit={onSubmit}>
        <div className="entity-form-section">
          <div className="entity-form-section__header">
            <span className="entity-form-section__eyebrow">Comercial</span>
            <h4 className="entity-form-section__title">Canal, cliente e pagamento</h4>
            <p className="entity-form-section__description">
              Defina como o pedido entrou e quem vai receber a proposta comercial.
            </p>
          </div>

          <div className="entity-stack">
            <div className="ui-field">
              <label className="ui-label" htmlFor="order-source">Canal</label>
              <select
                id="order-source"
                className="ui-select"
                value={formState.source}
                onChange={(event) => onFieldChange('source', event.target.value)}
              >
                {sourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {getChannelLabel(source)}
                  </option>
                ))}
              </select>
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="order-customer">Cliente</label>
              <select
                id="order-customer"
                className="ui-select"
                value={formState.customerId}
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
              <label className="ui-label" htmlFor="order-payment-method">Forma de pagamento</label>
              <select
                id="order-payment-method"
                className="ui-select"
                value={formState.paymentMethod}
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

        <div className="entity-form-section entity-form-section--span-2">
          <div className="entity-form-section__header">
            <span className="entity-form-section__eyebrow">Itens</span>
            <h4 className="entity-form-section__title">Monte o pedido</h4>
            <p className="entity-form-section__description">
              Adicione os produtos e confira o subtotal em tempo real.
            </p>
          </div>

          <div className="orders-domain__items">
            {formState.items.map((item, index) => (
              <div key={`${item.productId || 'novo'}-${index}`} className="orders-domain__item-row">
                <div className="ui-field">
                  <label className="ui-label" htmlFor={`order-item-product-${index}`}>Produto</label>
                  <select
                    id={`order-item-product-${index}`}
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
                  <label className="ui-label" htmlFor={`order-item-quantity-${index}`}>Quantidade</label>
                  <input
                    id={`order-item-quantity-${index}`}
                    className="ui-input"
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(event) => onItemChange(index, 'quantity', event.target.value)}
                  />
                </div>

                <div className="ui-field">
                  <label className="ui-label" htmlFor={`order-item-price-${index}`}>Preco unitario</label>
                  <input
                    id={`order-item-price-${index}`}
                    className="ui-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(event) => onItemChange(index, 'unitPrice', event.target.value)}
                  />
                </div>

                <div className="orders-domain__item-total">
                  <span className="orders-domain__item-total-label">Total do item</span>
                  <strong>{formatCurrencyBRL(draftItems[index]?.totalPrice ?? 0)}</strong>
                </div>

                <button
                  type="button"
                  className="ui-button ui-button--danger"
                  onClick={() => onRemoveItem(index)}
                  disabled={formState.items.length === 1}
                >
                  Remover
                </button>
              </div>
            ))}

            <button type="button" className="ui-button ui-button--ghost" onClick={onAddItem}>
              Adicionar item
            </button>
          </div>
        </div>

        <div className="entity-form-section entity-form-section--span-2">
          <div className="entity-form-section__header">
            <span className="entity-form-section__eyebrow">Entrega</span>
            <h4 className="entity-form-section__title">Endereco e observacoes</h4>
            <p className="entity-form-section__description">
              Mantenha as informacoes operacionais organizadas para despacho e acompanhamento.
            </p>
          </div>

          <div className="entity-stack">
            <div className="ui-field">
              <label className="ui-label" htmlFor="order-neighborhood">Bairro</label>
              <input
                id="order-neighborhood"
                className="ui-input"
                value={formState.address.neighborhood}
                onChange={(event) => onAddressChange('neighborhood', event.target.value)}
              />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="order-address">Endereco</label>
              <input
                id="order-address"
                className="ui-input"
                value={formState.address.addressLine}
                onChange={(event) => onAddressChange('addressLine', event.target.value)}
              />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="order-reference">Referencia</label>
              <input
                id="order-reference"
                className="ui-input"
                value={formState.address.reference}
                onChange={(event) => onAddressChange('reference', event.target.value)}
              />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="order-complement">Complemento</label>
              <input
                id="order-complement"
                className="ui-input"
                value={formState.address.complement}
                onChange={(event) => onAddressChange('complement', event.target.value)}
              />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="order-notes">Observacoes</label>
              <textarea
                id="order-notes"
                className="ui-textarea"
                rows={4}
                value={formState.notes}
                onChange={(event) => onFieldChange('notes', event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="entity-form-section entity-form-section--span-2">
          <div className="entity-form-section__header">
            <span className="entity-form-section__eyebrow">Totais</span>
            <h4 className="entity-form-section__title">Frete, adicional e descontos</h4>
            <p className="entity-form-section__description">
              O backend continua sendo a fonte de verdade para os totais e validacoes.
            </p>
          </div>

          <div className="orders-domain__totals-grid">
            <div className="ui-field">
              <label className="ui-label" htmlFor="order-freight">Frete</label>
              <input
                id="order-freight"
                className="ui-input"
                type="number"
                min="0"
                step="0.01"
                value={formState.totals.freight}
                onChange={(event) => onTotalsChange('freight', event.target.value)}
              />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="order-extra">Adicional</label>
              <input
                id="order-extra"
                className="ui-input"
                type="number"
                min="0"
                step="0.01"
                value={formState.totals.extraAmount}
                onChange={(event) => onTotalsChange('extraAmount', event.target.value)}
              />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="order-discount-percent">Desconto (%)</label>
              <input
                id="order-discount-percent"
                className="ui-input"
                type="number"
                min="0"
                step="0.01"
                value={formState.totals.discountPercent}
                onChange={(event) => onTotalsChange('discountPercent', event.target.value)}
              />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="order-discount-value">Desconto (R$)</label>
              <input
                id="order-discount-value"
                className="ui-input"
                type="number"
                min="0"
                step="0.01"
                value={formState.totals.discountValue}
                onChange={(event) => onTotalsChange('discountValue', event.target.value)}
              />
            </div>
          </div>

          <div className="orders-domain__summary">
            <div className="orders-domain__summary-row">
              <span>Subtotal</span>
              <strong>{formatCurrencyBRL(calculatedTotals.subtotal)}</strong>
            </div>
            <div className="orders-domain__summary-row">
              <span>Frete</span>
              <strong>{formatCurrencyBRL(calculatedTotals.freight)}</strong>
            </div>
            <div className="orders-domain__summary-row">
              <span>Adicional</span>
              <strong>{formatCurrencyBRL(calculatedTotals.extraAmount)}</strong>
            </div>
            <div className="orders-domain__summary-row">
              <span>Desconto</span>
              <strong>{formatCurrencyBRL(calculatedTotals.discountValue)}</strong>
            </div>
            <div className="orders-domain__summary-row orders-domain__summary-row--total">
              <span>Total final</span>
              <strong>{formatCurrencyBRL(calculatedTotals.total)}</strong>
            </div>
          </div>
        </div>

        <div className="entity-form-actions entity-form-grid__wide">
          <button type="button" className="ui-button ui-button--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="ui-button ui-button--primary" disabled={saving || !canWrite}>
            {saving ? 'Salvando...' : editingOrderId ? 'Salvar pedido' : 'Criar pedido'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default OrderFormPanel;
