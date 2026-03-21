import { getAdminFirestore } from '../../firebaseAdmin.js';
import { normalizeSaleDomainStatus } from './saleValidationService.js';

const COLLECTIONS = {
  stores: 'stores',
  orders: 'orders',
  sales: 'sales',
};

function getStoreDocument(storeId) {
  return getAdminFirestore()
    .collection(COLLECTIONS.stores)
    .doc(storeId);
}

function mapSnapshot(snapshot) {
  return {
    id: snapshot.id,
    data: snapshot.data(),
  };
}

export function createSaleRepository() {
  return {
    getSaleRef(storeId, saleId) {
      return getStoreDocument(storeId).collection(COLLECTIONS.sales).doc(saleId);
    },

    getOrderRef(storeId, orderId) {
      return getStoreDocument(storeId).collection(COLLECTIONS.orders).doc(orderId);
    },

    createSaleRef(storeId) {
      return getStoreDocument(storeId).collection(COLLECTIONS.sales).doc();
    },

    async getSaleById({ storeId, saleId }) {
      const snapshot = await this.getSaleRef(storeId, saleId).get();
      return snapshot.exists ? mapSnapshot(snapshot) : null;
    },

    async getOrderById({ storeId, orderId }) {
      const snapshot = await this.getOrderRef(storeId, orderId).get();
      return snapshot.exists ? mapSnapshot(snapshot) : null;
    },

    async createDirectSale({ storeId, payload }) {
      const saleRef = this.createSaleRef(storeId);
      await saleRef.set(payload);
      return { id: saleRef.id, data: payload };
    },

    async createSaleFromOrder({ storeId, orderId, payload, previousOrderStatus = 'OPEN' }) {
      const firestore = getAdminFirestore();
      const saleRef = this.createSaleRef(storeId);
      const orderRef = this.getOrderRef(storeId, orderId);
      const batch = firestore.batch();

      batch.set(saleRef, payload);
      batch.update(orderRef, {
        status: 'CONVERTED_TO_SALE',
        saleStatus: 'LAUNCHED',
        saleId: saleRef.id,
        updatedAt: new Date(),
      });

      await batch.commit();

      return {
        id: saleRef.id,
        saleId: saleRef.id,
        previousOrderStatus,
        data: payload,
      };
    },

    async deleteSale({ storeId, saleId }) {
      await this.getSaleRef(storeId, saleId).delete();
    },

    async deleteSaleRecord({ storeId, saleId }) {
      const firestore = getAdminFirestore();
      const saleRef = this.getSaleRef(storeId, saleId);

      return firestore.runTransaction(async (transaction) => {
        const saleSnapshot = await transaction.get(saleRef);

        if (!saleSnapshot.exists) {
          throw createSaleError('Venda nao encontrada.', 404, 'SALE_NOT_FOUND');
        }

        const currentSale = saleSnapshot.data();

        if (currentSale.orderId) {
          const orderRef = this.getOrderRef(storeId, currentSale.orderId);
          const orderSnapshot = await transaction.get(orderRef);

          if (orderSnapshot.exists) {
            transaction.update(orderRef, {
              status: currentSale.orderSnapshot?.status ?? 'OPEN',
              saleStatus: 'NOT_LAUNCHED',
              saleId: null,
              updatedAt: new Date(),
            });
          }
        }

        transaction.delete(saleRef);

        return {
          id: saleId,
          data: currentSale,
        };
      });
    },

    async revertSaleFromOrder({ storeId, orderId, saleId, previousOrderStatus = 'OPEN' }) {
      const firestore = getAdminFirestore();
      const saleRef = this.getSaleRef(storeId, saleId);
      const orderRef = this.getOrderRef(storeId, orderId);

      await firestore.runTransaction(async (transaction) => {
        transaction.delete(saleRef);
        transaction.update(orderRef, {
          status: previousOrderStatus,
          saleStatus: 'NOT_LAUNCHED',
          saleId: null,
          updatedAt: new Date(),
        });
      });
    },

    async markPostingFlags({ storeId, saleId, stockPosted, financialPosted }) {
      await this.getSaleRef(storeId, saleId).set({
        stockPosted,
        financialPosted,
        updatedAt: new Date(),
      }, { merge: true });
    },

    async updateSaleStatus({ storeId, saleId, status }) {
      const saleRef = this.getSaleRef(storeId, saleId);
      const snapshot = await saleRef.get();

      if (!snapshot.exists) {
        throw createSaleError('Venda nao encontrada.', 404, 'SALE_NOT_FOUND');
      }

      const currentSale = snapshot.data();
      const currentStatus = normalizeSaleDomainStatus(currentSale.status, 'POSTED');
      const nextStatus = normalizeSaleDomainStatus(status, null);

      if (!nextStatus) {
        throw createSaleError('Status de venda invalido.');
      }

      await saleRef.set({
        status: nextStatus,
        updatedAt: new Date(),
      }, { merge: true });

      return {
        id: saleId,
        previousStatus: currentStatus,
        data: {
          ...currentSale,
          status: nextStatus,
          updatedAt: new Date(),
        },
      };
    },
  };
}
