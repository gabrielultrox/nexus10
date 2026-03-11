import { getAdminFirestore } from '../../firebaseAdmin.js';

const COLLECTIONS = {
  stores: 'stores',
  financialEntries: 'financial_entries',
};

function getFinancialEntriesCollection(storeId) {
  return getAdminFirestore()
    .collection(COLLECTIONS.stores)
    .doc(storeId)
    .collection(COLLECTIONS.financialEntries);
}

export function createFinanceRepository() {
  return {
    getFinancialEntryRef(storeId, entryId) {
      return getFinancialEntriesCollection(storeId).doc(entryId);
    },

    async getFinancialEntryById(storeId, entryId) {
      const snapshot = await this.getFinancialEntryRef(storeId, entryId).get();
      return snapshot.exists ? snapshot.data() : null;
    },

    async upsertFinancialEntry(storeId, entryId, payload) {
      await this.getFinancialEntryRef(storeId, entryId).set(payload, { merge: true });
      return entryId;
    },
  };
}
