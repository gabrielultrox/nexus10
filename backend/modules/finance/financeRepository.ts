import type { CollectionReference, DocumentData, DocumentReference } from 'firebase-admin/firestore'

import { getAdminFirestore } from '../../firebaseAdmin.js'

const COLLECTIONS = {
  stores: 'stores',
  financialEntries: 'financial_entries',
  financialClosures: 'financial_closures',
} as const

function getFinancialEntriesCollection(storeId: string): CollectionReference<DocumentData> {
  return getAdminFirestore()
    .collection(COLLECTIONS.stores)
    .doc(storeId)
    .collection(COLLECTIONS.financialEntries)
}

function getFinancialClosuresCollection(storeId: string): CollectionReference<DocumentData> {
  return getAdminFirestore()
    .collection(COLLECTIONS.stores)
    .doc(storeId)
    .collection(COLLECTIONS.financialClosures)
}

export function createFinanceRepository() {
  return {
    getFinancialEntryRef(storeId: string, entryId: string): DocumentReference<DocumentData> {
      return getFinancialEntriesCollection(storeId).doc(entryId)
    },

    getFinancialClosureRef(storeId: string, closureId: string): DocumentReference<DocumentData> {
      return getFinancialClosuresCollection(storeId).doc(closureId)
    },

    async getFinancialEntryById(
      storeId: string,
      entryId: string,
    ): Promise<Record<string, unknown> | null> {
      const snapshot = await this.getFinancialEntryRef(storeId, entryId).get()
      return snapshot.exists
        ? ((snapshot.data() as Record<string, unknown> | undefined) ?? null)
        : null
    },

    async upsertFinancialEntry(
      storeId: string,
      entryId: string,
      payload: Record<string, unknown>,
    ): Promise<string> {
      await this.getFinancialEntryRef(storeId, entryId).set(payload, { merge: true })
      return entryId
    },

    async upsertFinancialClosure(
      storeId: string,
      closureId: string,
      payload: Record<string, unknown>,
    ): Promise<string> {
      await this.getFinancialClosureRef(storeId, closureId).set(payload, { merge: true })
      return closureId
    },
  }
}
