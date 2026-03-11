import { orderColumns } from '../schemas/orderSchema';
import OrdersColumn from './OrdersColumn';

function OrdersBoard({ groupedOrders, onAdvanceOrder, onOpenDetails, updatingOrderId }) {
  return (
    <section className="orders-board">
      {orderColumns.map((column) => (
        <OrdersColumn
          key={column}
          status={column}
          orders={groupedOrders[column] ?? []}
          onAdvanceOrder={onAdvanceOrder}
          onOpenDetails={onOpenDetails}
          updatingOrderId={updatingOrderId}
        />
      ))}
    </section>
  );
}

export default OrdersBoard;
