export const orderStatusMap = {
  received: {
    label: 'Recebido',
    badgeClass: 'ui-badge--info',
    columnClass: 'orders-column--received',
  },
  preparing: {
    label: 'Preparando',
    badgeClass: 'ui-badge--warning',
    columnClass: 'orders-column--preparing',
  },
  out_for_delivery: {
    label: 'Saiu',
    badgeClass: 'ui-badge--info',
    columnClass: 'orders-column--out',
  },
  delivered: {
    label: 'Entregue',
    badgeClass: 'ui-badge--success',
    columnClass: 'orders-column--delivered',
  },
  cancelled: {
    label: 'Cancelado',
    badgeClass: 'ui-badge--danger',
    columnClass: 'orders-column--received',
  },
}

export const orderPriorityMap = {
  normal: {
    label: 'Padrao',
    badgeClass: 'ui-badge--info',
  },
  high: {
    label: 'Urgente',
    badgeClass: 'ui-badge--danger',
  },
}

export const orderStatusOptions = [
  { value: 'all', label: 'Todos os status' },
  { value: 'received', label: 'Recebido' },
  { value: 'preparing', label: 'Preparando' },
  { value: 'out_for_delivery', label: 'Saiu' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'cancelled', label: 'Cancelado' },
]

export const orderOriginOptions = [
  { value: 'all', label: 'Todas as origens' },
  { value: 'Balcao', label: 'Balcao' },
  { value: 'Anota Ai', label: 'Anota Ai' },
]

export const orderColumns = ['received', 'preparing', 'out_for_delivery', 'delivered', 'cancelled']
