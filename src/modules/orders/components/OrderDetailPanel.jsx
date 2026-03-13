import {
  formatCurrencyBRL,
  getChannelLabel,
  getOrderDomainStatusLabel,
  getPaymentMethodLabel,
} from '../../../services/commerce'
import { printOrderTicket } from '../../../services/commercePrint'

function OrderDetailPanel({
  selectedOrder,
  isLoading,
  requestedOrderId,
  canWrite,
  acting,
  onEdit,
  onDispatch,
  onConvertToSale,
  formatDateTime,
}) {
  const orderSource = selectedOrder
    ? selectedOrder.origin
      || selectedOrder.sourceLabel
      || getChannelLabel(selectedOrder.sourceChannel ?? selectedOrder.source)
    : '--'
  const paymentLabel = selectedOrder
    ? selectedOrder.paymentMethodLabel || getPaymentMethodLabel(selectedOrder.paymentMethod)
    : '--'
  const isSaleLaunched = selectedOrder?.saleStatus === 'LAUNCHED'

  return (
    <div className="orders-domain__detail-shell">
      <div className="orders-domain__detail-header">
        <div>
          <p className="text-section-title">Detalhe do Pedido</p>
        </div>

        {selectedOrder ? (
          <div className="orders-domain__detail-actions">
            <button
              type="button"
              className="ui-button ui-button--ghost"
              onClick={() => printOrderTicket(selectedOrder)}
            >
              Imprimir pedido
            </button>
            <button
              type="button"
              className="ui-button ui-button--ghost"
              onClick={onEdit}
              disabled={!canWrite || isSaleLaunched}
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
                || isSaleLaunched
                || selectedOrder.domainStatus === 'CANCELLED'
              }
            >
              Gerar venda
            </button>
          </div>
        ) : null}
      </div>

      {!selectedOrder ? (
        <div className="module-empty-state">
          <p className="module-empty-state__text">
            {isLoading ? 'Carregando...' : requestedOrderId ? 'Pedido nao encontrado' : 'Selecione um pedido'}
          </p>
        </div>
      ) : (
        <div className="orders-domain__detail">
          <div className="commerce-detail-band">
            <span className="ui-badge ui-badge--info">{orderSource}</span>
            <span className="ui-badge ui-badge--warning">{getOrderDomainStatusLabel(selectedOrder.domainStatus)}</span>
            <span className={`ui-badge ${isSaleLaunched ? 'ui-badge--success' : 'ui-badge--special'}`}>
              {isSaleLaunched ? 'Venda lancada' : 'Venda nao lancada'}
            </span>
            <span className="ui-badge ui-badge--special">{paymentLabel}</span>
          </div>

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
              <strong>{orderSource}</strong>
              <small>{paymentLabel}</small>
            </div>
            <div className="orders-domain__detail-card">
              <span>Status</span>
              <strong>{getOrderDomainStatusLabel(selectedOrder.domainStatus)}</strong>
              <small>{isSaleLaunched ? 'Pronto para consulta em vendas' : 'Aguardando conversao'}</small>
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

          <div className="orders-domain__detail-panels">
            <div className={`orders-domain__timeline-card${isSaleLaunched ? ' orders-domain__timeline-card--launched' : ''}`}>
              <span className="orders-domain__notes-label">Conversao e auditoria</span>
              <div className="orders-domain__timeline-list">
                <div className="orders-domain__timeline-step">
                  <strong>Pedido criado</strong>
                  <p>{formatDateTime(selectedOrder.createdAt)}</p>
                </div>
                <div className="orders-domain__timeline-step">
                  <strong>Expedicao</strong>
                  <p>{selectedOrder.domainStatus === 'DISPATCHED' ? 'Marcado como despachado' : 'Ainda em aberto'}</p>
                </div>
                <div className="orders-domain__timeline-step">
                  <strong>Geracao de venda</strong>
                  <p>{isSaleLaunched ? `Venda vinculada: ${selectedOrder.saleId}` : 'Ainda sem venda vinculada'}</p>
                </div>
                <div className="orders-domain__timeline-step">
                  <strong>Impacto definitivo</strong>
                  <p>{isSaleLaunched ? 'Somente a venda publicou estoque e financeiro' : 'Sem impacto em estoque ou financeiro'}</p>
                </div>
              </div>
            </div>

            <div className="orders-domain__notes">
              <span className="orders-domain__notes-label">Observacoes</span>
              <p>{selectedOrder.notes || 'Nenhuma observacao registrada.'}</p>
              <p>{selectedOrder.saleId ? `Venda vinculada: ${selectedOrder.saleId}` : 'Ainda sem venda vinculada.'}</p>
            </div>
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
  )
}

export default OrderDetailPanel
