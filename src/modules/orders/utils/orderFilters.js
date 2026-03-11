import { orderColumns } from '../schemas/orderSchema';

export function filterOrders(orders, filters) {
  const searchTerm = filters.search.trim().toLowerCase();

  return orders.filter((order) => {
    const matchesSearch =
      searchTerm.length === 0 ||
      [
        order.id,
        order.number,
        order.customerName,
        order.neighborhood,
        order.itemsSummary,
        order.courierName,
        order.origin,
        order.paymentMethod,
      ]
        .join(' ')
        .toLowerCase()
        .includes(searchTerm);

    const matchesStatus = filters.status === 'all' || order.status === filters.status;
    const matchesOrigin = filters.origin === 'all' || order.origin === filters.origin;
    const matchesHighPriority = !filters.highPriorityOnly || order.priority === 'high';

    return matchesSearch && matchesStatus && matchesOrigin && matchesHighPriority;
  });
}

export function groupOrdersByStatus(orders) {
  return orderColumns.reduce((accumulator, column) => {
    accumulator[column] = orders.filter((order) => order.status === column);
    return accumulator;
  }, {});
}

export function countOrdersByStatus(orders, status) {
  return orders.filter((order) => order.status === status).length;
}
