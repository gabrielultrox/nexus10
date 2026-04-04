import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useLocation } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { useStore } from '../contexts/StoreContext'
import { useToast } from '../hooks/useToast'
import { useLiveNotifications } from '../hooks/useLiveNotifications'
import { buildAuditActor, recordAuditLog } from '../services/auditLog'
import { isOrderClosedStatus, isSalePosted, normalizeOrderDomainStatus } from '../services/commerce'
import {
  canUseRemoteSync,
  firebaseDb,
  firebaseReady,
  guardRemoteSubscription,
} from '../services/firebase'
import { FIRESTORE_COLLECTIONS } from '../services/firestoreCollections'
import { subscribeToInventoryItems } from '../services/inventory'
import { manualModuleConfigs } from '../services/manualModuleConfig'
import { subscribeToManualModuleRecords } from '../services/manualModuleService'
import {
  ADVANCES_REMINDER_STORAGE_KEY,
  createNotificationFromLiveEvent,
  dismissNotification,
  loadNotifications,
  loadNotificationPreferences,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  NOTIFICATIONS_EVENT,
  notifyDelayedOrder,
  notifyImportantError,
  notifyLowStock,
  notifyMachineConfirmation,
  notifyNewOrder,
  notifyOpenAdvancesReminder,
  notifySaleCompleted,
  persistNotificationPreferences,
  pushNotification,
  shouldPresentNotification,
  subscribeToNotificationPreferences,
} from '../services/notificationService'
import { subscribeToSales } from '../services/sales'
import {
  isSoundEnabled,
  playError,
  playNotification,
  playWarning,
  setSoundEnabled,
} from '../services/soundManager'

type NotificationRecord = Record<string, any>
type PreferencesRecord = Record<string, any>

const NotificationsContext = createContext<any>(null)
const NotificationLiveStatusContext = createContext<any>({
  connectionStatus: 'idle',
  lastConnectedAt: null,
})
const delayedOrderThresholdMinutes = 35
const advancesReminderHour = 23
const advancesReminderMinute = 30
const MAX_PRESENTED_PER_MINUTE = 5

function asDate(value: any) {
  if (!value) {
    return null
  }

  return typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
}

function isOrderDelayed(order: NotificationRecord) {
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

function supportsVibration() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { currentStoreId, tenantId } = useStore() as {
    currentStoreId: string | null
    tenantId: string | null
  }
  const { session } = useAuth() as { session: NotificationRecord | null }
  const toastApi = useToast()
  const [notifications, setNotifications] = useState<NotificationRecord[]>(() =>
    loadNotifications(),
  )
  const [advanceRecords, setAdvanceRecords] = useState<NotificationRecord[]>([])
  const [preferences, setPreferences] = useState<PreferencesRecord>(() =>
    loadNotificationPreferences({ storeId: currentStoreId, userId: session?.uid, session }),
  )
  const operationalNotificationsEnabled = Boolean(
    currentStoreId && session?.uid && location.pathname !== '/login',
  )
  const [deferredNotificationsEnabled, setDeferredNotificationsEnabled] = useState(false)
  const ordersInitializedRef = useRef(false)
  const salesInitializedRef = useRef(false)
  const inventoryInitializedRef = useRef(false)
  const knownSaleIdsRef = useRef<Set<string>>(new Set())
  const machineStatusRef = useRef<Map<string, string>>(new Map())
  const advancesReminderTimeoutRef = useRef<number | null>(null)
  const presentationWindowRef = useRef<number[]>([])
  const liveNotifications = useLiveNotifications({
    enabled: deferredNotificationsEnabled,
    storeId: currentStoreId,
  })
  const shouldUseFirestoreNotificationFallback =
    deferredNotificationsEnabled && liveNotifications.connectionStatus !== 'connected'

  useEffect(() => {
    if (!operationalNotificationsEnabled) {
      setDeferredNotificationsEnabled(false)
      return undefined
    }

    let cancelled = false
    let timeoutId: number | null = null
    let idleId: number | null = null

    const activate = () => {
      if (!cancelled) {
        setDeferredNotificationsEnabled(true)
      }
    }

    timeoutId = window.setTimeout(activate, 900)

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(activate, { timeout: 1200 })
    }

    return () => {
      cancelled = true
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
      if (idleId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
    }
  }, [operationalNotificationsEnabled])

  function presentNotification(notification: NotificationRecord) {
    if (!shouldPresentNotification(notification, preferences)) {
      return
    }

    const now = Date.now()
    presentationWindowRef.current = presentationWindowRef.current.filter(
      (timestamp) => now - timestamp < 60_000,
    )
    const withinLimit = presentationWindowRef.current.length < MAX_PRESENTED_PER_MINUTE

    if (!withinLimit) {
      return
    }

    presentationWindowRef.current.push(now)

    if (preferences?.channels?.toast !== false) {
      const toastVariant =
        notification.type === 'danger'
          ? 'error'
          : notification.type === 'success'
            ? 'success'
            : notification.type === 'warning'
              ? 'warning'
              : 'info'
      toastApi.toast(notification.message, toastVariant)
    }

    if (preferences?.channels?.sound !== false && isSoundEnabled()) {
      if (notification.type === 'danger') {
        playError()
      } else if (notification.type === 'warning') {
        playWarning()
      } else {
        playNotification()
      }
    }

    if (preferences?.channels?.vibration && supportsVibration()) {
      navigator.vibrate(notification.type === 'danger' ? [120, 60, 120] : [80])
    }
  }

  useEffect(() => {
    function syncNotifications() {
      setNotifications(loadNotifications())
    }

    function handleNotificationsUpdated(event: any) {
      syncNotifications()

      if (event.detail?.action === 'created' && event.detail?.notification) {
        presentNotification(event.detail.notification)
      }
    }

    syncNotifications()
    window.addEventListener(NOTIFICATIONS_EVENT, handleNotificationsUpdated)
    return () => window.removeEventListener(NOTIFICATIONS_EVENT, handleNotificationsUpdated)
  }, [preferences, toastApi])

  useEffect(() => {
    if (!deferredNotificationsEnabled || !currentStoreId || !session?.uid) {
      setPreferences(loadNotificationPreferences({ storeId: null, userId: null, session }))
      return undefined
    }

    return subscribeToNotificationPreferences({
      storeId: currentStoreId,
      userId: session.uid,
      session,
      onData: setPreferences,
      onError: () => undefined,
    })
  }, [currentStoreId, deferredNotificationsEnabled, session])

  useEffect(() => {
    if (!deferredNotificationsEnabled) {
      return undefined
    }

    const unsubscribeLive = liveNotifications.subscribe('notification', (event) => {
      const notification = createNotificationFromLiveEvent(event)

      if (!shouldPresentNotification(notification, preferences)) {
        return
      }

      pushNotification(notification)
    })

    return () => unsubscribeLive()
  }, [deferredNotificationsEnabled, liveNotifications, preferences])

  useEffect(() => {
    if (!deferredNotificationsEnabled || !currentStoreId) {
      setAdvanceRecords([])
      return undefined
    }

    const advancesConfig = manualModuleConfigs.advances
    return subscribeToManualModuleRecords({
      storeId: currentStoreId,
      modulePath: 'advances',
      storageKey: advancesConfig.storageKey,
      initialRecords: advancesConfig.initialRecords,
      dailyResetHour: advancesConfig.dailyResetHour as any,
      onData: setAdvanceRecords,
      onError: (error: any) =>
        notifyImportantError(error.message ?? 'Nao foi possivel acompanhar os vales.'),
    })
  }, [currentStoreId, deferredNotificationsEnabled])

  useEffect(() => {
    if (!deferredNotificationsEnabled || !currentStoreId) {
      machineStatusRef.current = new Map()
      return undefined
    }

    const config = manualModuleConfigs['machine-history']
    return subscribeToManualModuleRecords({
      storeId: currentStoreId,
      modulePath: 'machine-history',
      storageKey: config.storageKey,
      initialRecords: config.initialRecords,
      dailyResetHour: config.dailyResetHour as any,
      onData(records: NotificationRecord[]) {
        const nextMap = new Map()

        records.forEach((record: NotificationRecord) => {
          nextMap.set(record.id, record.status)
          const previousStatus = machineStatusRef.current.get(record.id)
          if (previousStatus && previousStatus !== record.status && record.status === 'Presente') {
            notifyMachineConfirmation(record)
          }
        })

        machineStatusRef.current = nextMap
      },
      onError: (error: any) =>
        notifyImportantError(
          error.message ?? 'Nao foi possivel acompanhar o checklist de maquininhas.',
        ),
    })
  }, [currentStoreId, deferredNotificationsEnabled])

  useEffect(() => {
    if (!deferredNotificationsEnabled) {
      if (advancesReminderTimeoutRef.current) {
        clearTimeout(advancesReminderTimeoutRef.current)
        advancesReminderTimeoutRef.current = null
      }
      return undefined
    }

    function markReminderAsSent(todayKey: string) {
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
        (record: NotificationRecord) => record.status !== 'Baixado',
      ).length

      if (
        !shouldRunAdvancesReminder(now) ||
        openAdvancesCount === 0 ||
        getLastReminderDate() === todayKey
      ) {
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
  }, [advanceRecords, deferredNotificationsEnabled])

  useEffect(() => {
    function handleWindowError(event: ErrorEvent) {
      if (event.message) {
        notifyImportantError(event.message)
      }
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
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

    if (
      !shouldUseFirestoreNotificationFallback ||
      !firebaseReady ||
      !firebaseDb ||
      !currentStoreId ||
      !canUseRemoteSync()
    ) {
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
                  const orderData: NotificationRecord = { id: change.doc.id, ...change.doc.data() }
                  notifyNewOrder(orderData)
                  recordAuditLog({
                    storeId: currentStoreId,
                    tenantId,
                    actor: buildAuditActor(),
                    action: 'order.created',
                    entityType: 'order',
                    entityId: change.doc.id,
                    description: `Pedido ${String(orderData.number ?? `#${change.doc.id.slice(0, 6).toUpperCase()}`)} entrou na fila operacional.`,
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
          (error) =>
            notifyImportantError(
              error.message ?? 'Nao foi possivel acompanhar pedidos para notificacoes.',
            ),
        ),
      {
        onError(error: any) {
          notifyImportantError(
            error.message ?? 'Nao foi possivel acompanhar pedidos para notificacoes.',
          )
        },
      },
    )

    const unsubscribeSales = subscribeToSales(
      currentStoreId,
      (sales: NotificationRecord[]) => {
        const nextKnownIds = new Set(knownSaleIdsRef.current)

        if (salesInitializedRef.current) {
          sales.forEach((sale: NotificationRecord) => {
            if (
              !knownSaleIdsRef.current.has(sale.id) &&
              isSalePosted(sale.domainStatus ?? sale.status)
            ) {
              notifySaleCompleted(sale)
            }
            nextKnownIds.add(sale.id)
          })
        } else {
          sales.forEach((sale: NotificationRecord) => nextKnownIds.add(sale.id))
        }

        knownSaleIdsRef.current = nextKnownIds
        salesInitializedRef.current = true
      },
      (error: any) => notifyImportantError(error.message),
    )

    const unsubscribeInventory = subscribeToInventoryItems(
      currentStoreId,
      (items: NotificationRecord[]) => {
        items
          .filter(
            (item: NotificationRecord) =>
              Number(item.currentStock ?? 0) <= Number(item.minimumStock ?? 0),
          )
          .forEach((item: NotificationRecord) => notifyLowStock(item))
        inventoryInitializedRef.current = true
      },
      (error: any) => notifyImportantError(error.message),
    )

    return () => {
      unsubscribeOrders()
      unsubscribeSales?.()
      unsubscribeInventory?.()
    }
  }, [currentStoreId, shouldUseFirestoreNotificationFallback, tenantId])

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: notifications.filter((notification) => !notification.read).length,
      connectionStatus: deferredNotificationsEnabled
        ? liveNotifications.connectionStatus
        : operationalNotificationsEnabled
          ? 'pending'
          : 'idle',
      lastConnectedAt: liveNotifications.lastConnectedAt,
      preferences,
      async updatePreferences(nextPreferences: PreferencesRecord) {
        const merged = await persistNotificationPreferences({
          storeId: currentStoreId,
          userId: session?.uid,
          session,
          preferences: {
            ...preferences,
            ...nextPreferences,
            channels: { ...(preferences?.channels ?? {}), ...(nextPreferences?.channels ?? {}) },
            types: { ...(preferences?.types ?? {}), ...(nextPreferences?.types ?? {}) },
          },
        })

        setPreferences(merged)
        if (Object.prototype.hasOwnProperty.call(nextPreferences?.channels ?? {}, 'sound')) {
          setSoundEnabled(Boolean(nextPreferences.channels.sound))
        }
        return merged
      },
      markAsRead(notificationId: string) {
        markNotificationAsRead(notificationId)
      },
      markAllAsRead() {
        markAllNotificationsAsRead()
      },
      dismiss(notificationId: string) {
        dismissNotification(notificationId)
      },
      reconnect() {
        liveNotifications.reconnect()
      },
    }),
    [
      currentStoreId,
      deferredNotificationsEnabled,
      liveNotifications,
      notifications,
      operationalNotificationsEnabled,
      preferences,
      session,
    ],
  )

  const liveStatusValue = useMemo(
    () => ({
      connectionStatus: deferredNotificationsEnabled
        ? liveNotifications.connectionStatus
        : operationalNotificationsEnabled
          ? 'pending'
          : 'idle',
      lastConnectedAt: liveNotifications.lastConnectedAt,
    }),
    [
      deferredNotificationsEnabled,
      liveNotifications.connectionStatus,
      liveNotifications.lastConnectedAt,
      operationalNotificationsEnabled,
    ],
  )

  return (
    <NotificationLiveStatusContext.Provider value={liveStatusValue}>
      <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
    </NotificationLiveStatusContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)

  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider')
  }

  return context
}

export function useNotificationLiveStatus() {
  return useContext(NotificationLiveStatusContext)
}
