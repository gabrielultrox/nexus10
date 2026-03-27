import { loadLocalRecords, saveLocalRecords } from './localAccess'

export const NOTIFICATIONS_STORAGE_KEY = 'nexus-operational-notifications'
export const NOTIFICATIONS_EVENT = 'nexus:notifications-updated'
export const ADVANCES_REMINDER_STORAGE_KEY = 'nexus-advances-reminder-last-date'

function createNotificationId() {
  return `notification-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function dispatchNotificationsUpdated(action, notification) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent(NOTIFICATIONS_EVENT, {
      detail: {
        action,
        notification,
      },
    }),
  )
}

export function loadNotifications() {
  return loadLocalRecords(NOTIFICATIONS_STORAGE_KEY, [])
}

export function saveNotifications(notifications) {
  saveLocalRecords(NOTIFICATIONS_STORAGE_KEY, notifications.slice(0, 120))
  dispatchNotificationsUpdated('saved')
}

export function createNotification({
  eventKey,
  type = 'info',
  title,
  message,
  persistent = true,
  metadata = {},
}) {
  return {
    id: createNotificationId(),
    eventKey,
    type,
    title,
    message,
    persistent,
    metadata,
    read: false,
    createdAt: new Date().toISOString(),
  }
}

export function pushNotification(notification) {
  const currentNotifications = loadNotifications()

  if (
    notification.eventKey &&
    currentNotifications.some((item) => item.eventKey === notification.eventKey)
  ) {
    return null
  }

  const nextNotifications = [notification, ...currentNotifications].slice(0, 120)
  saveLocalRecords(NOTIFICATIONS_STORAGE_KEY, nextNotifications)
  dispatchNotificationsUpdated('created', notification)
  return notification
}

export function markNotificationAsRead(notificationId) {
  const nextNotifications = loadNotifications().map((notification) =>
    notification.id === notificationId ? { ...notification, read: true } : notification,
  )

  saveNotifications(nextNotifications)
}

export function markAllNotificationsAsRead() {
  const nextNotifications = loadNotifications().map((notification) => ({
    ...notification,
    read: true,
  }))

  saveNotifications(nextNotifications)
}

export function dismissNotification(notificationId) {
  const nextNotifications = loadNotifications().filter(
    (notification) => notification.id !== notificationId,
  )
  saveNotifications(nextNotifications)
}

export function notifyNewOrder(order) {
  return pushNotification(
    createNotification({
      eventKey: `order-new-${order.id}`,
      type: 'info',
      title: 'Novo pedido',
      message: `Pedido ${order.id} entrou na fila operacional.`,
      metadata: {
        orderId: order.id,
        route: '/orders',
      },
    }),
  )
}

export function notifyDelayedOrder(order) {
  return pushNotification(
    createNotification({
      eventKey: `order-delayed-${order.id}`,
      type: 'warning',
      title: 'Pedido atrasado',
      message: `Pedido ${order.id} esta acima do tempo esperado e requer atencao.`,
      metadata: {
        orderId: order.id,
        route: '/orders',
      },
    }),
  )
}

export function notifySaleCompleted(sale) {
  return pushNotification(
    createNotification({
      eventKey: `sale-completed-${sale.id}`,
      type: 'success',
      title: 'Venda concluida',
      message: `Venda ${sale.id} concluida em ${sale.paymentMethod ?? 'pagamento nao informado'}.`,
      metadata: {
        saleId: sale.id,
        route: '/sales',
      },
    }),
  )
}

export function notifyLowStock(item) {
  return pushNotification(
    createNotification({
      eventKey: `stock-low-${item.productId}-${item.currentStock}`,
      type: 'warning',
      title: 'Estoque baixo',
      message: `${item.productName} esta com ${item.currentStock} unidade(s), abaixo do minimo.`,
      metadata: {
        productId: item.productId,
        route: '/inventory',
      },
    }),
  )
}

export function notifyImportantError(message) {
  const normalizedMessage = String(message ?? 'Erro importante').trim()
  const minuteKey = new Date().toISOString().slice(0, 16)

  return pushNotification(
    createNotification({
      eventKey: `important-error-${normalizedMessage}-${minuteKey}`,
      type: 'danger',
      title: 'Erro importante',
      message: normalizedMessage,
      metadata: {
        route: null,
      },
    }),
  )
}

export function notifyOpenAdvancesReminder({ openCount }) {
  const count = Number(openCount ?? 0)
  const label = count === 1 ? '1 vale em aberto' : `${count} vales em aberto`
  const todayKey = new Date().toISOString().slice(0, 10)

  return pushNotification(
    createNotification({
      eventKey: `advances-reminder-${todayKey}`,
      type: 'warning',
      title: 'Descontar vales do entregador',
      message: `${label}. Confira e desconte do entregador antes do fechamento.`,
      metadata: {
        route: '/advances',
        openCount: count,
      },
    }),
  )
}
