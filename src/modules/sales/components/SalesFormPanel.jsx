import { formatCurrencyBRL, getChannelLabel, getPaymentMethodLabel } from '../../../services/commerce';
import { channelOptions, paymentOptions } from './salesModuleHelpers';

function SalesFormPanel({
  canWrite,
  customers,
  products,
  formState,
  saving,
  draftItems,
  calculatedTotals,
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
    <div className="sales-domain__detail-shell">
      <div className="sales-domain__detail-header">
        <div>
          <p className="text-section-title">Nova Venda</p>
          <p className="text-body">Lance uma venda real com itens, totais e detalhes finais.</p>
        </div>
      </div>

      <form className="entity-form-grid" onSubmit={onSubmit}>
        <div className="entity-form-section">
          <div className="entity-form-section__header">
            <span className="entity-form-section__eyebrow">Finalizacao</span>
            <h4 className="entity-form-section__title">Cliente, canal e pagamento</h4>
            <p className="entity-form-section__description">Os campos abaixo definem a identidade comercial da venda.</p>
          </div>

          <div className="entity-stack">
            <div className="ui-field">
              <label className="ui-label" htmlFor="sale-channel">Canal</label>
              <select id="sale-channel" className="ui-select" value={formState.channel} onChange={(event) => onFieldChange('channel', event.target.value)}>
                {channelOptions.map((channel) => (
                  <option key={channel} value={channel}>{getChannelLabel(channel)}</option>
                ))}
              </select>
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="sale-customer">Cliente</label>
              <select id="sale-customer" className="ui-select" value={formState.customerId} onChange={(event) => onCustomerChange(event.target.value)}>
                <option value="">Cliente avulso</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="sale-payment-method">Forma de pagamento</label>
              <select id="sale-payment-method" className="ui-select" value={formState.paymentMethod} onChange={(event) => onFieldChange('paymentMethod', event.target.value)}>
                {paymentOptions.map((paymentMethod) => (
                  <option key={paymentMethod} value={paymentMethod}>{getPaymentMethodLabel(paymentMethod)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="entity-form-section entity-form-section--span-2">
          <div className="entity-form-section__header">
            <span className="entity-form-section__eyebrow">Itens</span>
            <h4 className="entity-form-section__title">Monte a venda</h4>
            <p className="entity-form-section__description">Escolha os produtos, quantidades e valores unitarios antes de postar.</p>
          </div>

          <div className="sales-domain__items">
            {formState.items.map((item, index) => (
              <div key={`${item.productId || 'novo'}-${index}`} className="sales-domain__item-row">
                <div className="ui-field">
                  <label className="ui-label" htmlFor={`sale-item-product-${index}`}>Produto</label>
                  <select id={`sale-item-product-${index}`} className="ui-select" value={item.productId} onChange={(event) => onItemChange(index, 'productId', event.target.value)}>
                    <option value="">Selecione</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                </div>

                <div className="ui-field">
                  <label className="ui-label" htmlFor={`sale-item-quantity-${index}`}>Quantidade</label>
                  <input id={`sale-item-quantity-${index}`} className="ui-input" type="number" min="1" step="1" value={item.quantity} onChange={(event) => onItemChange(index, 'quantity', event.target.value)} />
                </div>

                <div className="ui-field">
                  <label className="ui-label" htmlFor={`sale-item-price-${index}`}>Preco unitario</label>
                  <input id={`sale-item-price-${index}`} className="ui-input" type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => onItemChange(index, 'unitPrice', event.target.value)} />
                </div>

                <div className="sales-domain__item-total">
                  <span className="sales-domain__item-total-label">Total do item</span>
                  <strong>{formatCurrencyBRL(draftItems[index]?.totalPrice ?? 0)}</strong>
                </div>

                <button type="button" className="ui-button ui-button--danger" onClick={() => onRemoveItem(index)} disabled={formState.items.length === 1}>
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
            <p className="entity-form-section__description">Use estes campos quando a venda exigir contexto operacional adicional.</p>
          </div>

          <div className="entity-stack">
            <div className="ui-field">
              <label className="ui-label" htmlFor="sale-neighborhood">Bairro</label>
              <input id="sale-neighborhood" className="ui-input" value={formState.address.neighborhood} onChange={(event) => onAddressChange('neighborhood', event.target.value)} />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="sale-address">Endereco</label>
              <input id="sale-address" className="ui-input" value={formState.address.addressLine} onChange={(event) => onAddressChange('addressLine', event.target.value)} />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="sale-reference">Referencia</label>
              <input id="sale-reference" className="ui-input" value={formState.address.reference} onChange={(event) => onAddressChange('reference', event.target.value)} />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="sale-complement">Complemento</label>
              <input id="sale-complement" className="ui-input" value={formState.address.complement} onChange={(event) => onAddressChange('complement', event.target.value)} />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="sale-notes">Observacoes</label>
              <textarea id="sale-notes" className="ui-textarea" rows={4} value={formState.notes} onChange={(event) => onFieldChange('notes', event.target.value)} />
            </div>
          </div>
        </div>

        <div className="entity-form-section entity-form-section--span-2">
          <div className="entity-form-section__header">
            <span className="entity-form-section__eyebrow">Totais</span>
            <h4 className="entity-form-section__title">Frete, adicional e descontos</h4>
            <p className="entity-form-section__description">Os totais sao recalculados automaticamente antes de enviar ao backend.</p>
          </div>

          <div className="sales-domain__totals-grid">
            <div className="ui-field">
              <label className="ui-label" htmlFor="sale-freight">Frete</label>
              <input id="sale-freight" className="ui-input" type="number" min="0" step="0.01" value={formState.totals.freight} onChange={(event) => onTotalsChange('freight', event.target.value)} />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="sale-extra">Adicional</label>
              <input id="sale-extra" className="ui-input" type="number" min="0" step="0.01" value={formState.totals.extraAmount} onChange={(event) => onTotalsChange('extraAmount', event.target.value)} />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="sale-discount-percent">Desconto (%)</label>
              <input id="sale-discount-percent" className="ui-input" type="number" min="0" step="0.01" value={formState.totals.discountPercent} onChange={(event) => onTotalsChange('discountPercent', event.target.value)} />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="sale-discount-value">Desconto (R$)</label>
              <input id="sale-discount-value" className="ui-input" type="number" min="0" step="0.01" value={formState.totals.discountValue} onChange={(event) => onTotalsChange('discountValue', event.target.value)} />
            </div>
          </div>

          <div className="sales-domain__summary">
            <div className="sales-domain__summary-row"><span>Subtotal</span><strong>{formatCurrencyBRL(calculatedTotals.subtotal)}</strong></div>
            <div className="sales-domain__summary-row"><span>Frete</span><strong>{formatCurrencyBRL(calculatedTotals.freight)}</strong></div>
            <div className="sales-domain__summary-row"><span>Adicional</span><strong>{formatCurrencyBRL(calculatedTotals.extraAmount)}</strong></div>
            <div className="sales-domain__summary-row"><span>Desconto</span><strong>{formatCurrencyBRL(calculatedTotals.discountValue)}</strong></div>
            <div className="sales-domain__summary-row sales-domain__summary-row--total"><span>Total final</span><strong>{formatCurrencyBRL(calculatedTotals.total)}</strong></div>
          </div>
        </div>

        <div className="entity-form-actions entity-form-grid__wide">
          <button type="button" className="ui-button ui-button--ghost" onClick={onCancel}>Cancelar</button>
          <button type="submit" className="ui-button ui-button--primary" disabled={saving || !canWrite}>
            {saving ? 'Lancando...' : 'Lancar venda'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default SalesFormPanel;
