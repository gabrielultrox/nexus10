import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';

import { useStore } from './StoreContext';
import { buildAuditActor, recordAuditLog } from '../services/auditLog';
import {
  isOrderClosedStatus,
  isSalePosted,
  normalizeOrderDomainStatus,
} from '../services/commerce';
import { firebaseDb, firebaseReady } from '../services/firebase';
import { subscribeToInventoryItems } from '../services/inventory';
import {
  dismissNotification,
  loadNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  NOTIFICATIONS_EVENT,
  notifyDelayedOrder,
  notifyImportantError,
  notifyLowStock,
  notifyNewOrder,
  notifySaleCompleted,
} from '../services/notifications';
import { subscribeToSales } from '../services/sales';
import { FIRESTORE_COLLECTIONS } from '../services/firestoreCollections';
import { playNotification } from '../services/soundManager';

const NotificationsContext = createContext(null);
const delayedOrderThresholdMinutes = 35;

function asDate(value) {
  if (!value) {
    return null;
  }

  return typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
}

function isOrderDelayed(order) {
  const createdAt = asDate(order.createdAt);

  if (!createdAt) {
    return false;
  }

  if (isOrderClosedStatus(normalizeOrderDomainStatus(order.status))) {
    return false;
  }

  return (Date.now() - createdAt.getTime()) / 60000 >= delayedOrderThresholdMinutes;
}

export function NotificationsProvider({ children }) {
  const { currentStoreId, tenantId } = useStore();
  const [notifications, setNotifications] = useState(() => loadNotifications());
  const ordersInitializedRef = useRef(false);
  const salesInitializedRef = useRef(false);
  const inventoryInitializedRef = useRef(false);
  const knownSaleIdsRef = useRef(new Set());

  useEffect(() => {
    function syncNotifications() {
      setNotifications(loadNotifications());
    }

    function handleNotificationsUpdated(event) {
      syncNotifications();

      if (event.detail?.action === 'created') {
        playNotification();
      }
    }

    syncNotifications();
    window.addEventListener(NOTIFICATIONS_EVENT, handleNotificationsUpdated);
    return () => window.removeEventListener(NOTIFICATIONS_EVENT, handleNotificationsUpdated);
  }, []);

  useEffect(() => {
    function handleWindowError(event) {
      if (event.message) {
        notifyImportantError(event.message);
      }
    }

    function handleUnhandledRejection(event) {
      const reason = event.reason?.message ?? String(event.reason ?? 'Falha inesperada de execucao.');
      notifyImportantError(reason);
    }

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    ordersInitializedRef.current = false;
    salesInitializedRef.current = false;
    inventoryInitializedRef.current = false;
    knownSaleIdsRef.current = new Set();

    if (!firebaseReady || !firebaseDb || !currentStoreId) {
      return undefined;
    }

    const ordersQuery = query(
      collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, currentStoreId, FIRESTORE_COLLECTIONS.orders),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const orders = snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }));

      if (ordersInitializedRef.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const orderData = {
              id: change.doc.id,
              ...change.doc.data(),
            };
            notifyNewOrder({
              ...orderData,
            });
            recordAuditLog({
              storeId: currentStoreId,
              tenantId,
              actor: buildAuditActor(),
              action: 'order.created',
              entityType: 'order',
              entityId: change.doc.id,
              description: `Pedido ${orderData.number ?? `#${change.doc.id.slice(0, 6).toUpperCase()}`} entrou na fila operacional.`,
            });
          }
        });
      }

      orders.forEach((order) => {
        if (isOrderDelayed(order)) {
          notifyDelayedOrder(order);
        }
      });

      ordersInitializedRef.current = true;
    });

    const unsubscribeSales = subscribeToSales(
      currentStoreId,
      (sales) => {
        const nextKnownIds = new Set(knownSaleIdsRef.current);

        if (salesInitializedRef.current) {
          sales.forEach((sale) => {
            if (!knownSaleIdsRef.current.has(sale.id) && isSalePosted(sale.domainStatus ?? sale.status)) {
              notifySaleCompleted(sale);
            }

            nextKnownIds.add(sale.id);
          });
        } else {
          sales.forEach((sale) => nextKnownIds.add(sale.id));
        }

        knownSaleIdsRef.current = nextKnownIds;
        salesInitializedRef.current = true;
      },
      (error) => notifyImportantError(error.message),
    );

    const unsubscribeInventory = subscribeToInventoryItems(
      currentStoreId,
      (items) => {
        items
          .filter((item) => Number(item.currentStock ?? 0) <= Number(item.minimumStock ?? 0))
          .forEach((item) => notifyLowStock(item));

        inventoryInitializedRef.current = true;
      },
      (error) => notifyImportantError(error.message),
    );

    return () => {
      unsubscribeOrders();
      unsubscribeSales?.();
      unsubscribeInventory?.();
    };
  }, [currentStoreId, tenantId]);

  const value = useMemo(() => ({
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read).length,
    markAsRead(notificationId) {
      markNotificationAsRead(notificationId);
    },
    markAllAsRead() {
      markAllNotificationsAsRead();
    },
    dismiss(notificationId) {
      dismissNotification(notificationId);
    },
  }), [notifications]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);

  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }

  return context;
}
