import { getAdminFirestore } from '../../firebaseAdmin.js';

const COLLECTIONS = {
  stores: 'stores',
  auditLogs: 'audit_logs',
};

export function createAuditRepository() {
  return {
    async createAuditLog({ storeId, payload }) {
      const documentRef = getAdminFirestore()
        .collection(COLLECTIONS.stores)
        .doc(storeId)
        .collection(COLLECTIONS.auditLogs)
        .doc();

      await documentRef.set({
        ...payload,
        createdAt: payload.createdAt ?? new Date(),
      });

      return documentRef.id;
    },
  };
}
