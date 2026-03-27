import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'

import { useStore } from './StoreContext'
import { buildAuditActor, recordAuditLog } from '../services/auditLog'
import { isOrderClosedStatus, isSalePosted, normalizeOrderDomainStatus } from '../services/commerce'
import {
  canUseRemoteSync,
  firebaseDb,
  firebaseReady,
  guardRemoteSubscription,
} from '../services/firebase'
import { subscribeToInventoryItems } from '../services/inventory'
import {
  ADVANCES_REMINDER_STORAGE_KEY,
  dismissNotification,
  loadNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  NOTIFICATIONS_EVENT,
  notifyDelayedOrder,
  notifyImportantError,
  notifyLowStock,
  notifyNewOrder,
  notifyOpenAdvancesReminder,
  notifySaleCompleted,
} from '../services/notifications'
import { subscribeToSales } from '../services/sales'
import { FIRESTORE_COLLECTIONS } from '../services/firestoreCollections'
import { manualModuleConfigs } from '../services/manualModuleConfig'
import { subscribeToManualModuleRecords } from '../services/manualModuleService'
import { playNotification } from '../services/soundManager'

const NotificationsContext = createContext(null)
const delayedOrderThresholdMinutes = 35
const advancesReminderHour = 23
const advancesReminderMinute = 30

function asDate(value) {
  if (!value) {
    return null
  }

  return typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
}

function isOrderDelayed(order) {
  const createdAt = asDate(order.createdAt)

  if (!createdAt) {
    return false
  }

  if (isOrderClosedStatus(normalizeOrderDomainStatus(order.status))) {
    return false
  }

  return (Date.now() - createdAt.getTime()) / 60000 >= delayedOrderThresholdMinutes
}

function getTodayKey(value = new Date()) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getNextAdvancesReminderTime(now = new Date()) {
  const nextRun = new Date(now)
  nextRun.setHours(advancesReminderHour, advancesReminderMinute, 0, 0)

  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1)
  }

  return nextRun
}

function shouldRunAdvancesReminder(now = new Date()) {
  const gateTime = new Date(now)
  gateTime.setHours(advancesReminderHour, advancesReminderMinute, 0, 0)
  return now >= gateTime
}

export function NotificationsProvider({ children }) {
  const { currentStoreId, tenantId } = useStore()
  const [notifications, setNotifications] = useState(() => loadNotifications())
  const [advanceRecords, setAdvanceRecords] = useState([])
  const ordersInitializedRef = useRef(false)
  const salesInitializedRef = useRef(false)
  const inventoryInitializedRef = useRef(false)
  const knownSaleIdsRef = useRef(new Set())
  const advancesReminderTimeoutRef = useRef(null)

  useEffect(() => {
    function syncNotifications() {
      setNotifications(loadNotifications())
    }

    function handleNotificationsUpdated(event) {
      syncNotifications()

      if (event.detail?.action === 'created') {
        playNotification()
      }
    }

    syncNotifications()
    window.addEventListener(NOTIFICATIONS_EVENT, handleNotificationsUpdated)
    return () => window.removeEventListener(NOTIFICATIONS_EVENT, handleNotificationsUpdated)
  }, [])

  useEffect(() => {
    if (!currentStoreId) {
      setAdvanceRecords([])
      return undefined
    }

    const advancesConfig = manualModuleConfigs.advances

    return subscribeToManualModuleRecords({
      storeId: currentStoreId,
      modulePath: 'advances',
      storageKey: advancesConfig.storageKey,
      initialRecords: advancesConfig.initialRecords,
      dailyResetHour: advancesConfig.dailyResetHour ?? null,
      onData: setAdvanceRecords,
      onError: (error) =>
        notifyImportantError(error.message ?? 'Nao foi possivel acompanhar os vales.'),
    })
  }, [currentStoreId])

  useEffect(() => {
    function markReminderAsSent(todayKey) {
      if (typeof window === 'undefined') {
        return
      }

      window.localStorage.setItem(ADVANCES_REMINDER_STORAGE_KEY, todayKey)
    }

    function getLastReminderDate() {
      if (typeof window === 'undefined') {
        return ''
      }

      return window.localStorage.getItem(ADVANCES_REMINDER_STORAGE_KEY) ?? ''
    }

    function maybeNotifyOpenAdvances() {
      const now = new Date()
      const todayKey = getTodayKey(now)
      const openAdvancesCount = advanceRecords.filter(
        (record) => record.status !== 'Baixado',
      ).length

      if (!shouldRunAdvancesReminder(now) || openAdvancesCount === 0) {
        return
      }

      if (getLastReminderDate() === todayKey) {
        return
      }

      const notification = notifyOpenAdvancesReminder({ openCount: openAdvancesCount })

      if (notification) {
        markReminderAsSent(todayKey)
      }
    }

    function scheduleNextReminderCheck() {
      if (advancesReminderTimeoutRef.current) {
        clearTimeout(advancesReminderTimeoutRef.current)
      }

      const nextRun = getNextAdvancesReminderTime()
      const delay = Math.max(1000, nextRun.getTime() - Date.now())

      advancesReminderTimeoutRef.current = window.setTimeout(() => {
        maybeNotifyOpenAdvances()
        scheduleNextReminderCheck()
      }, delay)
    }

    maybeNotifyOpenAdvances()
    scheduleNextReminderCheck()

    return () => {
      if (advancesReminderTimeoutRef.current) {
        clearTimeout(advancesReminderTimeoutRef.current)
        advancesReminderTimeoutRef.current = null
      }
    }
  }, [advanceRecords])

  useEffect(() => {
    function handleWindowError(event) {
      if (event.message) {
        notifyImportantError(event.message)
      }
    }

    function handleUnhandledRejection(event) {
      const reason =
        event.reason?.message ?? String(event.reason ?? 'Falha inesperada de execucao.')
      notifyImportantError(reason)
    }

    window.addEventListener('error', handleWindowError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('error', handleWindowError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  useEffect(() => {
    ordersInitializedRef.current = false
    salesInitializedRef.current = false
    inventoryInitializedRef.current = false
    knownSaleIdsRef.current = new Set()

    if (!firebaseReady || !firebaseDb || !currentStoreId || !canUseRemoteSync()) {
      return undefined
    }

    const ordersQuery = query(
      collection(
        firebaseDb,
        FIRESTORE_COLLECTIONS.stores,
        currentStoreId,
        FIRESTORE_COLLECTIONS.orders,
      ),
      orderBy('createdAt', 'desc'),
    )

    const unsubscribeOrders = guardRemoteSubscription(
      () =>
        onSnapshot(
          ordersQuery,
          (snapshot) => {
            const orders = snapshot.docs.map((documentSnapshot) => ({
              id: documentSnapshot.id,
              ...documentSnapshot.data(),
            }))

            if (ordersInitializedRef.current) {
              snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                  const orderData = {
                    id: change.doc.id,
                    ...change.doc.data(),
                  }
                  notifyNewOrder({
                    ...orderData,
                  })
                  recordAuditLog({
                    storeId: currentStoreId,
                    tenantId,
                    actor: buildAuditActor(),
                    action: 'order.created',
                    entityType: 'order',
                    entityId: change.doc.id,
                    description: `Pedido ${orderData.number ?? `#${change.doc.id.slice(0, 6).toUpperCase()}`} entrou na fila operacional.`,
                  })
                }
              })
            }

            orders.forEach((order) => {
              if (isOrderDelayed(order)) {
                notifyDelayedOrder(order)
              }
            })

            ordersInitializedRef.current = true
          },
          (error) => {
            notifyImportantError(
              error.message ?? 'Nao foi possivel acompanhar pedidos para notificacoes.',
            )
          },
        ),
      {
        onError(error) {
          notifyImportantError(
            error.message ?? 'Nao foi possivel acompanhar pedidos para notificacoes.',
          )
        },
      },
    )

    const unsubscribeSales = subscribeToSales(
      currentStoreId,
      (sales) => {
        const nextKnownIds = new Set(knownSaleIdsRef.current)

        if (salesInitializedRef.current) {
          sales.forEach((sale) => {
            if (
              !knownSaleIdsRef.current.has(sale.id) &&
              isSalePosted(sale.domainStatus ?? sale.status)
            ) {
              notifySaleCompleted(sale)
            }

            nextKnownIds.add(sale.id)
          })
        } else {
          sales.forEach((sale) => nextKnownIds.add(sale.id))
        }

        knownSaleIdsRef.current = nextKnownIds
        salesInitializedRef.current = true
      },
      (error) => notifyImportantError(error.message),
    )

    const unsubscribeInventory = subscribeToInventoryItems(
      currentStoreId,
      (items) => {
        items
          .filter((item) => Number(item.currentStock ?? 0) <= Number(item.minimumStock ?? 0))
          .forEach((item) => notifyLowStock(item))

        inventoryInitializedRef.current = true
      },
      (error) => notifyImportantError(error.message),
    )

    return () => {
      unsubscribeOrders()
      unsubscribeSales?.()
      unsubscribeInventory?.()
    }
  }, [currentStoreId, tenantId])

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: notifications.filter((notification) => !notification.read).length,
      markAsRead(notificationId) {
        markNotificationAsRead(notificationId)
      },
      markAllAsRead() {
        markAllNotificationsAsRead()
      },
      dismiss(notificationId) {
        dismissNotification(notificationId)
      },
    }),
    [notifications],
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationsContext)

  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider')
  }

  return context
}
