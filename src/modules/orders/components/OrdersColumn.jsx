import { orderStatusMap } from '../schemas/orderSchema';
import OrderCard from './OrderCard';

function OrdersColumn({ status, orders, onAdvanceOrder, onOpenDetails, updatingOrderId }) {
  const statusMeta = orderStatusMap[status];

  return (
    <section className={`ui-card orders-column ${statusMeta.columnClass}`}>
      <header className="orders-column__header">
        <div>
          <p className="text-overline">Status</p>
          <h2 className="orders-column__title">{statusMeta.label}</h2>
        </div>
        <span className={`ui-badge ${statusMeta.badgeClass}`}>{orders.length}</span>
      </header>

      <div className="orders-column__body">
        {orders.length > 0 ? (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onAdvanceOrder={onAdvanceOrder}
              onOpenDetails={onOpenDetails}
              updating={updatingOrderId === order.id}
            />
          ))
        ) : (
          <div className="orders-column__empty">
            <p className="text-label">Fila vazia</p>
            <p className="text-body">Nenhum pedido neste estagio com os filtros atuais.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default OrdersColumn;
