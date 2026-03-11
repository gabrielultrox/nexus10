import { getAdminFirestore } from '../../firebaseAdmin.js';

const COLLECTIONS = {
  stores: 'stores',
  products: 'products',
  stockItems: 'stock_items',
  legacyStockItems: 'inventory_items',
};

function getStoreDocument(storeId) {
  return getAdminFirestore()
    .collection(COLLECTIONS.stores)
    .doc(storeId);
}

export function createStockRepository() {
  return {
    getProductRef(storeId, productId) {
      return getStoreDocument(storeId).collection(COLLECTIONS.products).doc(productId);
    },

    getStockItemRef(storeId, productId) {
      return getStoreDocument(storeId).collection(COLLECTIONS.stockItems).doc(productId);
    },

    getLegacyStockItemRef(storeId, productId) {
      return getStoreDocument(storeId).collection(COLLECTIONS.legacyStockItems).doc(productId);
    },
  };
}
