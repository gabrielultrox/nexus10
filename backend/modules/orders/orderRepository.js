import { getAdminFirestore } from '../../firebaseAdmin.js';
import {
  createOrderError,
  normalizeOrderSaleStatus,
  normalizeOrderStatus,
} from './orderValidationService.js';

const COLLECTIONS = {
  stores: 'stores',
  orders: 'orders',
};

function getOrderDocument(storeId, orderId) {
  return getAdminFirestore()
    .collection(COLLECTIONS.stores)
    .doc(storeId)
    .collection(COLLECTIONS.orders)
    .doc(orderId);
}

function getOrdersCollection(storeId) {
  return getAdminFirestore()
    .collection(COLLECTIONS.stores)
    .doc(storeId)
    .collection(COLLECTIONS.orders);
}

function mapSnapshot(snapshot) {
  return {
    id: snapshot.id,
    data: snapshot.data(),
  };
}

export function createOrderRepository() {
  return {
    async createOrder({ storeId, tenantId, payload }) {
      const now = new Date();
      const documentRef = getOrdersCollection(storeId).doc();
      const data = {
        ...payload,
        storeId,
        tenantId: tenantId ?? null,
        createdAt: now,
        updatedAt: now,
      };

      await documentRef.set(data);

      return {
        id: documentRef.id,
        data,
      };
    },

    async getOrderById({ storeId, orderId }) {
      const snapshot = await getOrderDocument(storeId, orderId).get();
      return snapshot.exists ? mapSnapshot(snapshot) : null;
    },

    async updateOrder({ storeId, orderId, payload }) {
      const documentRef = getOrderDocument(storeId, orderId);
      const snapshot = await documentRef.get();

      if (!snapshot.exists) {
        throw createOrderError('Pedido nao encontrado.', 404, 'ORDER_NOT_FOUND');
      }

      const currentOrder = snapshot.data();

      if (
        currentOrder.saleId
        || normalizeOrderSaleStatus(currentOrder.saleStatus, 'NOT_LAUNCHED') === 'LAUNCHED'
      ) {
        throw createOrderError(
          'Pedidos que ja geraram venda nao podem ser editados.',
          409,
          'ORDER_ALREADY_CONVERTED',
        );
      }

      const nextData = {
        ...payload,
        storeId,
        tenantId: currentOrder.tenantId ?? null,
        createdAt: currentOrder.createdAt ?? new Date(),
        createdBy: currentOrder.createdBy ?? null,
        updatedAt: new Date(),
      };

      await documentRef.set(nextData);

      return {
        id: orderId,
        data: nextData,
      };
    },

    async markOrderAsDispatched({ storeId, orderId }) {
      const documentRef = getOrderDocument(storeId, orderId);
      const snapshot = await documentRef.get();

      if (!snapshot.exists) {
        throw createOrderError('Pedido nao encontrado.', 404, 'ORDER_NOT_FOUND');
      }

      const currentOrder = snapshot.data();
      const currentStatus = normalizeOrderStatus(currentOrder.status, 'OPEN');

      if (currentStatus === 'CANCELLED' || currentStatus === 'CONVERTED_TO_SALE') {
        throw createOrderError(
          'Somente pedidos em aberto podem ser marcados como despachados.',
          409,
          'ORDER_CLOSED',
        );
      }

      const nextData = {
        ...currentOrder,
        status: 'DISPATCHED',
        updatedAt: new Date(),
      };

      await documentRef.set(nextData);

      return {
        id: orderId,
        data: nextData,
      };
    },

    async deleteOrder({ storeId, orderId }) {
      const documentRef = getOrderDocument(storeId, orderId);
      const snapshot = await documentRef.get();

      if (!snapshot.exists) {
        throw createOrderError('Pedido nao encontrado.', 404, 'ORDER_NOT_FOUND');
      }

      const currentOrder = snapshot.data();

      if (
        currentOrder.saleId
        || normalizeOrderSaleStatus(currentOrder.saleStatus, 'NOT_LAUNCHED') === 'LAUNCHED'
      ) {
        throw createOrderError(
          'Pedidos que ja geraram venda nao podem ser excluidos.',
          409,
          'ORDER_ALREADY_CONVERTED',
        );
      }

      await documentRef.delete();

      return {
        id: orderId,
        data: currentOrder,
      };
    },
  };
}
