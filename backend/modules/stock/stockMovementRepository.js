import { getAdminFirestore } from '../../firebaseAdmin.js';

const COLLECTIONS = {
  stores: 'stores',
  stockMovements: 'stock_movements',
  legacyStockMovements: 'inventory_movements',
};

function getStockMovementsCollection(storeId) {
  return getAdminFirestore()
    .collection(COLLECTIONS.stores)
    .doc(storeId)
    .collection(COLLECTIONS.stockMovements);
}

export function createStockMovementRepository() {
  return {
    createMovementRef(storeId, movementId = null) {
      return movementId
        ? getStockMovementsCollection(storeId).doc(movementId)
        : getStockMovementsCollection(storeId).doc();
    },

    createLegacyMovementRef(storeId, movementId = null) {
      const collectionRef = getAdminFirestore()
        .collection(COLLECTIONS.stores)
        .doc(storeId)
        .collection(COLLECTIONS.legacyStockMovements);

      return movementId ? collectionRef.doc(movementId) : collectionRef.doc();
    },
  };
}
