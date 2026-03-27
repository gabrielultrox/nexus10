import { getAdminFirestore } from '../../firebaseAdmin.js'

const COLLECTIONS = {
  stores: 'stores',
  financialEntries: 'financial_entries',
  financialClosures: 'financial_closures',
}

function getFinancialEntriesCollection(storeId) {
  return getAdminFirestore()
    .collection(COLLECTIONS.stores)
    .doc(storeId)
    .collection(COLLECTIONS.financialEntries)
}

function getFinancialClosuresCollection(storeId) {
  return getAdminFirestore()
    .collection(COLLECTIONS.stores)
    .doc(storeId)
    .collection(COLLECTIONS.financialClosures)
}

export function createFinanceRepository() {
  return {
    getFinancialEntryRef(storeId, entryId) {
      return getFinancialEntriesCollection(storeId).doc(entryId)
    },

    getFinancialClosureRef(storeId, closureId) {
      return getFinancialClosuresCollection(storeId).doc(closureId)
    },

    async getFinancialEntryById(storeId, entryId) {
      const snapshot = await this.getFinancialEntryRef(storeId, entryId).get()
      return snapshot.exists ? snapshot.data() : null
    },

    async upsertFinancialEntry(storeId, entryId, payload) {
      await this.getFinancialEntryRef(storeId, entryId).set(payload, { merge: true })
      return entryId
    },

    async upsertFinancialClosure(storeId, closureId, payload) {
      await this.getFinancialClosureRef(storeId, closureId).set(payload, { merge: true })
      return closureId
    },
  }
}
