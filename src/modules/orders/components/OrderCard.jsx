import { getNextOrderStatus } from '../../../services/orders'
import { orderPriorityMap, orderStatusMap } from '../schemas/orderSchema'

function OrderCard({ order, onAdvanceOrder, onOpenDetails, updating = false }) {
  const priority = orderPriorityMap[order.priority] ?? orderPriorityMap.normal
  const status = orderStatusMap[order.status] ?? orderStatusMap.received
  const nextStatus = getNextOrderStatus(order.status)
  const canAdvance = !order.isExternal && Boolean(nextStatus)

  return (
    <article className="ui-card ui-card--interactive order-card">
      <div className="order-card__header">
        <div>
          <p className="text-overline">{order.number}</p>
          <h3 className="order-card__title">{order.customerName}</h3>
        </div>

        <div className="order-card__badges">
          {order.source ? <span className="ui-badge ui-badge--special">{order.source}</span> : null}
          <span className={`ui-badge ${priority.badgeClass}`}>{priority.label}</span>
          <span className={`ui-badge ${status.badgeClass}`}>{status.label}</span>
        </div>
      </div>

      <div className="order-card__meta">
        <span>{order.neighborhood}</span>
        <span>{order.origin || 'Origem nao informada'}</span>
        <span>{order.paymentMethod || 'Pagamento nao informado'}</span>
      </div>

      <p className="order-card__summary">{order.itemsSummary}</p>

      <div className="order-card__metrics">
        <div className="order-card__metric">
          <span className="order-card__metric-label">Total</span>
          <strong>{order.total}</strong>
        </div>
        <div className="order-card__metric">
          <span className="order-card__metric-label">Entrada</span>
          <strong>{order.time}</strong>
        </div>
        <div className="order-card__metric">
          <span className="order-card__metric-label">Espera</span>
          <strong>{order.waitTime}</strong>
        </div>
      </div>

      <div className="order-card__footer">
        <div>
          <span className="order-card__metric-label">Entregador</span>
          <strong className="order-card__courier">{order.courierName}</strong>
        </div>

        <div className="order-card__actions">
          <button
            type="button"
            className="ui-button ui-button--secondary"
            onClick={() => onAdvanceOrder(order)}
            disabled={!canAdvance || updating}
          >
            {updating
              ? 'Salvando...'
              : order.isExternal
                ? 'Sincronizar'
                : nextStatus
                  ? 'Avancar'
                  : 'Concluido'}
          </button>
          <button
            type="button"
            className="ui-button ui-button--ghost"
            onClick={() => onOpenDetails(order)}
          >
            Detalhes
          </button>
        </div>
      </div>
    </article>
  )
}

export default OrderCard
