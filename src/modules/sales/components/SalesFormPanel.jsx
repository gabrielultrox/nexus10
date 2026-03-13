import {
  CommerceAddressSection,
  CommerceIdentitySection,
  CommerceItemsSection,
  CommerceTotalsSection,
} from '../../commerce/components/CommerceFormSections';
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
        </div>
      </div>

      <form className="entity-form-grid" onSubmit={onSubmit}>
        <CommerceIdentitySection
          eyebrow="Finalizacao"
          title="Cliente, canal e pagamento"
          channelId="sale-channel"
          channelField="channel"
          channelValue={formState.channel}
          channelOptions={channelOptions}
          customerFieldId="sale-customer"
          customerValue={formState.customerId}
          customers={customers}
          paymentId="sale-payment-method"
          paymentValue={formState.paymentMethod}
          paymentOptions={paymentOptions}
          onFieldChange={onFieldChange}
          onCustomerChange={onCustomerChange}
        />

        <CommerceItemsSection
          eyebrow="Itens"
          title="Monte a venda"
          items={formState.items}
          products={products}
          draftItems={draftItems}
          itemPrefix="sale"
          domainClassName="sales-domain"
          onItemChange={onItemChange}
          onRemoveItem={onRemoveItem}
          onAddItem={onAddItem}
        />

        <CommerceAddressSection
          eyebrow="Entrega"
          title="Endereco e observacoes"
          itemPrefix="sale"
          address={formState.address}
          notes={formState.notes}
          onAddressChange={onAddressChange}
          onFieldChange={onFieldChange}
        />

        <CommerceTotalsSection
          eyebrow="Totais"
          title="Frete, adicional e descontos"
          itemPrefix="sale"
          domainClassName="sales-domain"
          totals={formState.totals}
          calculatedTotals={calculatedTotals}
          onTotalsChange={onTotalsChange}
        />

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
