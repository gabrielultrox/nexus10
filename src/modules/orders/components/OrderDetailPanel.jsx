import { formatCurrencyBRL, getChannelLabel, getOrderDomainStatusLabel, getPaymentMethodLabel } from '../../../services/commerce';

function OrderDetailPanel({
  selectedOrder,
  canWrite,
  acting,
  onEdit,
  onDispatch,
  onConvertToSale,
  formatDateTime,
}) {
  return (
    <div className="orders-domain__detail-shell">
      <div className="orders-domain__detail-header">
        <div>
          <p className="text-section-title">Detalhe do Pedido</p>
          <p className="text-body">Consulte os dados comerciais e avance somente as acoes permitidas.</p>
        </div>

        {selectedOrder ? (
          <div className="orders-domain__detail-actions">
            <button
              type="button"
              className="ui-button ui-button--ghost"
              onClick={onEdit}
              disabled={!canWrite || selectedOrder.saleStatus === 'LAUNCHED'}
            >
              Editar pedido
            </button>
            <button
              type="button"
              className="ui-button ui-button--secondary"
              onClick={onDispatch}
              disabled={acting || !canWrite || selectedOrder.domainStatus !== 'OPEN'}
            >
              Marcar como despachado
            </button>
            <button
              type="button"
              className="ui-button ui-button--primary"
              onClick={onConvertToSale}
              disabled={
                acting
                || !canWrite
                || selectedOrder.saleStatus === 'LAUNCHED'
                || selectedOrder.domainStatus === 'CANCELLED'
              }
            >
              Gerar venda
            </button>
          </div>
        ) : null}
      </div>

      {!selectedOrder ? (
        <div className="entity-empty-state">
          <p className="text-section-title">Selecione um pedido</p>
          <p className="text-body">O detalhe completo aparece aqui assim que um pedido for escolhido.</p>
        </div>
      ) : (
        <div className="orders-domain__detail">
          <div className="orders-domain__detail-grid">
            <div className="orders-domain__detail-card">
              <span>Pedido</span>
              <strong>{selectedOrder.number}</strong>
              <small>{selectedOrder.code}</small>
            </div>
            <div className="orders-domain__detail-card">
              <span>Cliente</span>
              <strong>{selectedOrder.customerName}</strong>
              <small>{selectedOrder.customerSnapshot?.phone || 'Sem telefone'}</small>
            </div>
            <div className="orders-domain__detail-card">
              <span>Canal</span>
              <strong>{selectedOrder.origin || selectedOrder.sourceLabel || getChannelLabel(selectedOrder.sourceChannel ?? selectedOrder.source)}</strong>
              <small>{selectedOrder.paymentMethodLabel || getPaymentMethodLabel(selectedOrder.paymentMethod)}</small>
            </div>
            <div className="orders-domain__detail-card">
              <span>Status</span>
              <strong>{getOrderDomainStatusLabel(selectedOrder.domainStatus)}</strong>
              <small>{selectedOrder.saleStatus === 'LAUNCHED' ? 'Venda lancada' : 'Venda nao lancada'}</small>
            </div>
            <div className="orders-domain__detail-card">
              <span>Total</span>
              <strong>{formatCurrencyBRL(selectedOrder.totals?.total ?? 0)}</strong>
              <small>Subtotal {formatCurrencyBRL(selectedOrder.totals?.subtotal ?? 0)}</small>
            </div>
            <div className="orders-domain__detail-card">
              <span>Criado em</span>
              <strong>{formatDateTime(selectedOrder.createdAt)}</strong>
              <small>Atualizado em {formatDateTime(selectedOrder.updatedAt)}</small>
            </div>
          </div>

          <div className="orders-domain__detail-panels">
            <div className="orders-domain__summary">
              <div className="orders-domain__summary-row">
                <span>Frete</span>
                <strong>{formatCurrencyBRL(selectedOrder.totals?.freight ?? 0)}</strong>
              </div>
              <div className="orders-domain__summary-row">
                <span>Adicional</span>
                <strong>{formatCurrencyBRL(selectedOrder.totals?.extraAmount ?? 0)}</strong>
              </div>
              <div className="orders-domain__summary-row">
                <span>Desconto</span>
                <strong>{formatCurrencyBRL(selectedOrder.totals?.discountValue ?? 0)}</strong>
              </div>
              <div className="orders-domain__summary-row orders-domain__summary-row--total">
                <span>Total final</span>
                <strong>{formatCurrencyBRL(selectedOrder.totals?.total ?? 0)}</strong>
              </div>
            </div>

            <div className="orders-domain__notes">
              <span className="orders-domain__notes-label">Entrega</span>
              <strong>{selectedOrder.address?.addressLine || 'Endereco nao informado'}</strong>
              <p>{selectedOrder.address?.neighborhood || 'Bairro nao informado'}</p>
              <p>{selectedOrder.address?.reference || 'Sem referencia'}</p>
              <p>{selectedOrder.address?.complement || 'Sem complemento'}</p>
            </div>
          </div>

          <div className="orders-domain__notes">
            <span className="orders-domain__notes-label">Observacoes</span>
            <p>{selectedOrder.notes || 'Nenhuma observacao registrada.'}</p>
            <p>{selectedOrder.saleId ? `Venda vinculada: ${selectedOrder.saleId}` : 'Ainda sem venda vinculada.'}</p>
          </div>

          <div className="orders-domain__items-list">
            <p className="text-label">Itens do pedido</p>
            {selectedOrder.items?.map((item, index) => (
              <div key={`${item.productId || item.productSnapshot?.name}-${index}`} className="orders-domain__item-line">
                <div>
                  <strong>{item.productSnapshot?.name ?? item.name ?? 'Item'}</strong>
                  <p>{item.quantity} x {formatCurrencyBRL(item.unitPrice)}</p>
                </div>
                <strong>{formatCurrencyBRL(item.totalPrice)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderDetailPanel;
