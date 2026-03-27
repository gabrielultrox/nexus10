import {
  formatCurrencyBRL,
  getChannelLabel,
  getOrderDomainStatusLabel,
  getPaymentMethodLabel,
} from '../../../services/commerce'
import { printOrderTicket } from '../../../services/commercePrint'
import EmptyState from '../../../components/ui/EmptyState'

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
    ? selectedOrder.origin ||
      selectedOrder.sourceLabel ||
      getChannelLabel(selectedOrder.sourceChannel ?? selectedOrder.source)
    : '--'
  const paymentLabel = selectedOrder
    ? selectedOrder.paymentMethodLabel || getPaymentMethodLabel(selectedOrder.paymentMethod)
    : '--'
  const isSaleLaunched = selectedOrder?.saleStatus === 'LAUNCHED'
  const canEditOrder = Boolean(canWrite && !isSaleLaunched)
  const canDispatchOrder = Boolean(canWrite && !acting && selectedOrder?.domainStatus === 'OPEN')
  const canConvertOrder = Boolean(
    canWrite && !acting && !isSaleLaunched && selectedOrder?.domainStatus !== 'CANCELLED',
  )
  const hasPendingActions = canEditOrder || canDispatchOrder || canConvertOrder
  const statusDescription = isSaleLaunched
    ? 'Impacto em estoque e financeiro ja publicado.'
    : selectedOrder?.domainStatus === 'DISPATCHED'
      ? 'Pedido em rota, aguardando conversao em venda.'
      : 'Pedido ativo e pronto para seguir no fluxo operacional.'

  return (
    <div className="orders-domain__detail-shell">
      {!selectedOrder ? (
        <EmptyState
          message={
            isLoading
              ? 'Carregando...'
              : requestedOrderId
                ? 'Pedido nao encontrado'
                : 'Selecione um pedido'
          }
        />
      ) : (
        <div className="orders-domain__detail">
          <div className="orders-domain__detail-hero">
            <div className="orders-domain__detail-hero-main">
              <div className="orders-domain__detail-header">
                <div>
                  <p className="text-section-title">Detalhe do pedido</p>
                  <p className="text-body">Status, conversao e impacto operacional.</p>
                </div>
              </div>

              <div className="commerce-detail-band">
                <span className="ui-badge ui-badge--info">{orderSource}</span>
                <span className="ui-badge ui-badge--warning">
                  {getOrderDomainStatusLabel(selectedOrder.domainStatus)}
                </span>
                <span
                  className={`ui-badge ${isSaleLaunched ? 'ui-badge--success' : 'ui-badge--special'}`}
                >
                  {isSaleLaunched ? 'Venda lancada' : 'Venda nao lancada'}
                </span>
                <span className="ui-badge ui-badge--special">{paymentLabel}</span>
              </div>

              <div className="orders-domain__hero-summary">
                <div className="orders-domain__hero-kicker">Pedido em foco</div>
                <strong className="orders-domain__hero-order">{selectedOrder.number}</strong>
                <p className="orders-domain__hero-meta">
                  {selectedOrder.customerName} ·{' '}
                  {formatCurrencyBRL(selectedOrder.totals?.total ?? 0)}
                </p>
                <p className="orders-domain__hero-description">{statusDescription}</p>
              </div>
            </div>

            <aside className="orders-domain__action-rail">
              <span className="orders-domain__action-rail-label">Acoes</span>
              <div className="orders-domain__detail-actions">
                <button
                  type="button"
                  className="ui-button ui-button--ghost"
                  onClick={() => printOrderTicket(selectedOrder)}
                >
                  Imprimir pedido
                </button>
                {canEditOrder ? (
                  <button type="button" className="ui-button ui-button--ghost" onClick={onEdit}>
                    Editar pedido
                  </button>
                ) : null}
                {canDispatchOrder ? (
                  <button
                    type="button"
                    className="ui-button ui-button--secondary"
                    onClick={onDispatch}
                  >
                    Marcar como despachado
                  </button>
                ) : null}
                {canConvertOrder ? (
                  <button
                    type="button"
                    className="ui-button ui-button--primary"
                    onClick={onConvertToSale}
                  >
                    Gerar venda
                  </button>
                ) : null}
                {!hasPendingActions ? (
                  <p className="orders-domain__action-empty">
                    Sem acoes pendentes para este pedido.
                  </p>
                ) : null}
              </div>
            </aside>
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
              <small>{isSaleLaunched ? 'Disponivel em vendas' : 'Aguardando conversao'}</small>
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
            <div
              className={`orders-domain__timeline-card${isSaleLaunched ? ' orders-domain__timeline-card--launched' : ''}`}
            >
              <span className="orders-domain__notes-label">Conversao e auditoria</span>
              <div className="orders-domain__timeline-list">
                <div className="orders-domain__timeline-step">
                  <strong>Pedido criado</strong>
                  <p>{formatDateTime(selectedOrder.createdAt)}</p>
                </div>
                <div className="orders-domain__timeline-step">
                  <strong>Expedicao</strong>
                  <p>
                    {selectedOrder.domainStatus === 'DISPATCHED'
                      ? 'Marcado como despachado'
                      : 'Ainda em aberto'}
                  </p>
                </div>
                <div className="orders-domain__timeline-step">
                  <strong>Geracao de venda</strong>
                  <p>
                    {isSaleLaunched
                      ? `Venda vinculada: ${selectedOrder.saleId}`
                      : 'Ainda sem venda vinculada'}
                  </p>
                </div>
                <div className="orders-domain__timeline-step">
                  <strong>Impacto definitivo</strong>
                  <p>
                    {isSaleLaunched
                      ? 'Estoque e financeiro publicados pela venda'
                      : 'Sem impacto em estoque ou financeiro'}
                  </p>
                </div>
              </div>
            </div>

            <div className="orders-domain__notes">
              <span className="orders-domain__notes-label">Observacoes</span>
              <p>{selectedOrder.notes || 'Nenhuma observacao registrada.'}</p>
              <p>
                {selectedOrder.saleId
                  ? `Venda vinculada: ${selectedOrder.saleId}`
                  : 'Ainda sem venda vinculada.'}
              </p>
            </div>
          </div>

          <div className="orders-domain__items-list">
            <div className="orders-domain__items-header">
              <p className="text-label">Itens do pedido</p>
              <span className="ui-badge ui-badge--info">
                {selectedOrder.items?.length ?? 0} itens
              </span>
            </div>
            {selectedOrder.items?.map((item, index) => (
              <div
                key={`${item.productId || item.productSnapshot?.name}-${index}`}
                className="orders-domain__item-line"
              >
                <div>
                  <strong>{item.productSnapshot?.name ?? item.name ?? 'Item'}</strong>
                  <p>
                    {item.quantity} x {formatCurrencyBRL(item.unitPrice)}
                  </p>
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
