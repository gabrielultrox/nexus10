import { getAdminFirestore } from '../firebaseAdmin.js';

const COLLECTIONS = {
  stores: 'stores',
  externalOrders: 'external_orders',
  externalOrderEvents: 'external_order_events',
  externalOrderTracking: 'external_order_tracking',
  integrationLogs: 'integration_logs',
};

function getScopedCollection(storeId, collectionName) {
  return getAdminFirestore()
    .collection(COLLECTIONS.stores)
    .doc(storeId)
    .collection(collectionName);
}

export function createBackendExternalOrderRepository() {
  return {
    async hasProcessedEvent(storeId, eventId) {
      const snapshot = await getScopedCollection(storeId, COLLECTIONS.externalOrderEvents).doc(eventId).get();
      return snapshot.exists;
    },

    async upsertOrder({ storeId, tenantId, order }) {
      await getScopedCollection(storeId, COLLECTIONS.externalOrders)
        .doc(order.id)
        .set(
          {
            ...order,
            storeId,
            tenantId: tenantId ?? null,
            firestoreUpdatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
    },

    async upsertEvent({ storeId, tenantId, event }) {
      await getScopedCollection(storeId, COLLECTIONS.externalOrderEvents)
        .doc(event.id)
        .set(
          {
            ...event,
            storeId,
            tenantId: tenantId ?? null,
            firestoreUpdatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
    },

    async upsertTracking({ storeId, tenantId, trackingEntry }) {
      await getScopedCollection(storeId, COLLECTIONS.externalOrderTracking)
        .doc(trackingEntry.id)
        .set(
          {
            ...trackingEntry,
            storeId,
            tenantId: tenantId ?? null,
            firestoreUpdatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
    },

    async appendLog({ storeId, tenantId, log }) {
      const logId = log.id ?? `${log.source ?? 'integration'}:${Date.now()}:${Math.random().toString(16).slice(2, 8)}`;

      await getScopedCollection(storeId, COLLECTIONS.integrationLogs)
        .doc(logId)
        .set(
          {
            ...log,
            id: logId,
            storeId,
            tenantId: tenantId ?? null,
            createdAt: log.createdAt ?? new Date().toISOString(),
          },
          { merge: true },
        );
    },
  };
}
