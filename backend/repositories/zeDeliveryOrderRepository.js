import { getAdminFirestore } from '../firebaseAdmin.js'

const COLLECTIONS = {
  stores: 'stores',
  integrations: 'integrations',
  integrationDoc: 'ze_delivery',
  orders: 'orders',
  syncLogs: 'sync_logs',
}

function getIntegrationDocument(storeId) {
  return getAdminFirestore()
    .collection(COLLECTIONS.stores)
    .doc(storeId)
    .collection(COLLECTIONS.integrations)
    .doc(COLLECTIONS.integrationDoc)
}

function getOrdersCollection(storeId) {
  return getIntegrationDocument(storeId).collection(COLLECTIONS.orders)
}

function getLogsCollection(storeId) {
  return getIntegrationDocument(storeId).collection(COLLECTIONS.syncLogs)
}

function mapSnapshot(snapshot) {
  if (!snapshot.exists) {
    return null
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  }
}

export function createZeDeliveryOrderRepository() {
  return {
    async getOrder({ storeId, zeDeliveryId }) {
      const snapshot = await getOrdersCollection(storeId).doc(zeDeliveryId).get()
      return mapSnapshot(snapshot)
    },

    async upsertOrder({ storeId, order }) {
      await getOrdersCollection(storeId)
        .doc(order.zeDeliveryId)
        .set(
          {
            ...order,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        )
    },

    async listOrders({ storeId, limit = 20, status = '' }) {
      let query = getOrdersCollection(storeId).orderBy('timestamp', 'desc').limit(limit)

      if (status) {
        query = query.where('status', '==', status)
      }

      const snapshot = await query.get()
      return snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }))
    },

    async appendSyncLog({ storeId, log }) {
      const logId =
        log.id ?? `${log.runId ?? 'run'}:${Date.now()}:${Math.random().toString(16).slice(2, 8)}`

      await getLogsCollection(storeId)
        .doc(logId)
        .set(
          {
            ...log,
            id: logId,
            createdAt: log.createdAt ?? new Date().toISOString(),
          },
          { merge: true },
        )
    },

    async listSyncLogs({ storeId, limit = 20 }) {
      const snapshot = await getLogsCollection(storeId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get()

      return snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }))
    },

    async setStoreStatus({ storeId, status }) {
      await getIntegrationDocument(storeId).set(
        {
          ...status,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      )
    },

    async getStoreStatus({ storeId }) {
      const snapshot = await getIntegrationDocument(storeId).get()
      return mapSnapshot(snapshot)
    },

    async listStoreStatuses({ storeIds }) {
      return Promise.all(
        storeIds.map(async (storeId) => ({
          storeId,
          status: await this.getStoreStatus({ storeId }),
        })),
      )
    },
  }
}
