import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'

import { firebaseDb, firebaseReady, guardRemoteSubscription } from './firebase'
import { FIRESTORE_COLLECTIONS } from './firestoreCollections'
import { loadLocalRecords, saveLocalRecords } from './localAccess'

export const NOTIFICATIONS_STORAGE_KEY = 'nexus-operational-notifications'
export const NOTIFICATIONS_EVENT = 'nexus:notifications-updated'
export const ADVANCES_REMINDER_STORAGE_KEY = 'nexus-advances-reminder-last-date'
export const NOTIFICATION_PREFERENCES_STORAGE_KEY = 'nexus-notification-preferences'
export const E2E_LIVE_NOTIFICATION_EVENT = 'nexus10:e2e-live-notification'
const MAX_STORED_NOTIFICATIONS = 120

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
  saveLocalRecords(NOTIFICATIONS_STORAGE_KEY, notifications.slice(0, MAX_STORED_NOTIFICATIONS))
  dispatchNotificationsUpdated('saved')
}

export function createNotification({
  eventKey,
  type = 'info',
  title,
  message,
  persistent = true,
  metadata = {},
  source = 'local',
  channels = null,
}) {
  return {
    id: createNotificationId(),
    eventKey,
    type,
    title,
    message,
    persistent,
    metadata,
    source,
    channels,
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

  const nextNotifications = [notification, ...currentNotifications].slice(
    0,
    MAX_STORED_NOTIFICATIONS,
  )
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

function buildDefaultChannelPreferences(role = 'operador') {
  return {
    toast: true,
    badge: true,
    sound: role !== 'atendente',
    vibration: role === 'admin' || role === 'gerente',
  }
}

function buildDefaultTypePreferences(role = 'operador') {
  const financeEnabled = role === 'admin' || role === 'gerente' || role === 'operador'

  return {
    newOrder: true,
    machineConfirmation: role !== 'atendente',
    deliveryDelay: true,
    orderStatusChanged: true,
    cashCritical: financeEnabled,
    integrationAlert: role === 'admin' || role === 'gerente',
  }
}

export function buildDefaultNotificationPreferences(session = null) {
  const role = session?.role ?? 'operador'

  return {
    role,
    enabled: true,
    channels: buildDefaultChannelPreferences(role),
    types: buildDefaultTypePreferences(role),
    updatedAt: null,
  }
}

function getNotificationPreferencesRef(storeId, userId) {
  return doc(
    firebaseDb,
    FIRESTORE_COLLECTIONS.stores,
    storeId,
    FIRESTORE_COLLECTIONS.notificationsPreferences,
    userId,
  )
}

function getLocalPreferencesKey(storeId, userId) {
  return `${NOTIFICATION_PREFERENCES_STORAGE_KEY}:${storeId}:${userId}`
}

export function loadNotificationPreferences({ storeId, userId, session }) {
  const defaults = buildDefaultNotificationPreferences(session)

  if (!storeId || !userId || typeof window === 'undefined') {
    return defaults
  }

  const saved = loadLocalRecords(getLocalPreferencesKey(storeId, userId), null)

  if (!saved) {
    return defaults
  }

  return {
    ...defaults,
    ...saved,
    channels: { ...defaults.channels, ...(saved.channels ?? {}) },
    types: { ...defaults.types, ...(saved.types ?? {}) },
  }
}

export function saveNotificationPreferencesLocally({ storeId, userId, preferences }) {
  if (!storeId || !userId) {
    return
  }

  saveLocalRecords(getLocalPreferencesKey(storeId, userId), preferences)
}

export function subscribeToNotificationPreferences({ storeId, userId, session, onData, onError }) {
  const defaults = loadNotificationPreferences({ storeId, userId, session })
  onData(defaults)

  if (!firebaseReady || !firebaseDb || !storeId || !userId) {
    return () => {}
  }

  return guardRemoteSubscription(
    () =>
      onSnapshot(
        getNotificationPreferencesRef(storeId, userId),
        (snapshot) => {
          const remote = snapshot.exists() ? snapshot.data() : {}
          const nextPreferences = {
            ...defaults,
            ...remote,
            channels: { ...defaults.channels, ...(remote?.channels ?? {}) },
            types: { ...defaults.types, ...(remote?.types ?? {}) },
          }

          saveNotificationPreferencesLocally({ storeId, userId, preferences: nextPreferences })
          onData(nextPreferences)
        },
        onError,
      ),
    {
      onFallback() {
        onData(defaults)
      },
      onError,
    },
  )
}

export async function persistNotificationPreferences({ storeId, userId, session, preferences }) {
  const defaults = buildDefaultNotificationPreferences(session)
  const nextPreferences = {
    ...defaults,
    ...preferences,
    channels: { ...defaults.channels, ...(preferences?.channels ?? {}) },
    types: { ...defaults.types, ...(preferences?.types ?? {}) },
    updatedAt: new Date().toISOString(),
  }

  saveNotificationPreferencesLocally({ storeId, userId, preferences: nextPreferences })

  if (!firebaseReady || !firebaseDb || !storeId || !userId) {
    return nextPreferences
  }

  await setDoc(
    getNotificationPreferencesRef(storeId, userId),
    {
      ...nextPreferences,
      updatedBy: userId,
      updatedAtServer: serverTimestamp(),
    },
    { merge: true },
  )

  return nextPreferences
}

export function mapEventTypeToPreferenceKey(type) {
  switch (type) {
    case 'order.created':
      return 'newOrder'
    case 'machine.confirmed':
      return 'machineConfirmation'
    case 'delivery.delayed':
      return 'deliveryDelay'
    case 'order.status.changed':
      return 'orderStatusChanged'
    case 'cash.critical':
      return 'cashCritical'
    case 'integration.alert':
      return 'integrationAlert'
    default:
      return 'orderStatusChanged'
  }
}

export function createNotificationFromLiveEvent(event) {
  return createNotification({
    eventKey: `live-${event.id ?? event.type}-${event.createdAt ?? Date.now()}`,
    type:
      event.severity === 'error'
        ? 'danger'
        : event.severity === 'success'
          ? 'success'
          : event.severity === 'warning'
            ? 'warning'
            : 'info',
    title: event.title ?? 'Notificacao operacional',
    message: event.message ?? 'Evento em tempo real recebido.',
    metadata: {
      ...(event.metadata ?? {}),
      integration: event.integration ?? null,
      eventType: event.type ?? 'system.notice',
    },
    source: 'live',
    channels: event.channels ?? null,
  })
}

export function shouldPresentNotification(notification, preferences) {
  if (!preferences?.enabled) {
    return false
  }

  const preferenceKey = mapEventTypeToPreferenceKey(notification.metadata?.eventType)
  return preferences?.types?.[preferenceKey] !== false
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
        eventType: 'order.created',
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
        eventType: 'delivery.delayed',
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
        eventType: 'order.status.changed',
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
        eventType: 'integration.alert',
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
        eventType: 'integration.alert',
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
        eventType: 'cash.critical',
      },
    }),
  )
}

export function notifyMachineConfirmation(record) {
  return pushNotification(
    createNotification({
      eventKey: `machine-confirmed-${record.id}-${record.status}`,
      type: 'success',
      title: 'Checklist de maquininha',
      message: `${record.device ?? 'Maquininha'} marcada como ${String(record.status ?? '').toLowerCase()}.`,
      metadata: {
        route: '/machine-history',
        recordId: record.id,
        eventType: 'machine.confirmed',
      },
    }),
  )
}
