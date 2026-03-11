import {
  CommerceAddressSection,
  CommerceFormSignalBar,
  CommerceIdentitySection,
  CommerceItemsSection,
  CommerceTotalsSection,
} from '../../commerce/components/CommerceFormSections';

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

      <CommerceFormSignalBar
        eyebrow="Fluxo comercial"
        title={editingOrderId ? 'Ajuste o pedido com seguranca' : 'Monte um pedido com leitura imediata'}
        description="Itens, cliente, entrega e totais ficam agrupados em blocos claros para operar rapido sem poluir a tela."
        badges={[
          { label: formState.source === 'IFOOD' ? 'Canal iFood' : 'Canal operacional', tone: 'ui-badge--info' },
          { label: 'Sem estoque', tone: 'ui-badge--warning' },
          { label: 'Sem financeiro', tone: 'ui-badge--special' },
        ]}
      />

      <form className="entity-form-grid" onSubmit={onSubmit}>
        <CommerceIdentitySection
          eyebrow="Comercial"
          title="Canal, cliente e pagamento"
          description="Defina a origem do pedido e quem vai receber a proposta comercial."
          channelId="order-source"
          channelField="source"
          channelValue={formState.source}
          channelOptions={sourceOptions}
          customerFieldId="order-customer"
          customerValue={formState.customerId}
          customers={customers}
          paymentId="order-payment-method"
          paymentValue={formState.paymentMethod}
          paymentOptions={paymentOptions}
          onFieldChange={onFieldChange}
          onCustomerChange={onCustomerChange}
        />

        <CommerceItemsSection
          eyebrow="Itens"
          title="Monte o pedido"
          description="Adicione os produtos, ajuste quantidades e acompanhe o subtotal no mesmo bloco."
          items={formState.items}
          products={products}
          draftItems={draftItems}
          itemPrefix="order"
          domainClassName="orders-domain"
          onItemChange={onItemChange}
          onRemoveItem={onRemoveItem}
          onAddItem={onAddItem}
        />

        <CommerceAddressSection
          eyebrow="Entrega"
          title="Endereco e observacoes"
          description="Organize o contexto operacional do despacho sem espalhar os campos pela tela."
          itemPrefix="order"
          address={formState.address}
          notes={formState.notes}
          onAddressChange={onAddressChange}
          onFieldChange={onFieldChange}
        />

        <CommerceTotalsSection
          eyebrow="Totais"
          title="Frete, adicional e descontos"
          description="A leitura dos totais fica concentrada em um quadro final de conferência."
          itemPrefix="order"
          domainClassName="orders-domain"
          totals={formState.totals}
          calculatedTotals={calculatedTotals}
          onTotalsChange={onTotalsChange}
        />

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
