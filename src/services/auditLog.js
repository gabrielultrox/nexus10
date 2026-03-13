import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';

import { assertFirebaseReady, canUseRemoteSync, firebaseDb, guardRemoteSubscription } from './firebase';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';

function getAuditLogsCollectionRef(storeId) {
  assertFirebaseReady();
  return collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.auditLogs);
}

function mapSnapshot(snapshot) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export function buildAuditActor(session) {
  return {
    id: session?.uid ?? null,
    name: session?.operatorName ?? session?.displayName ?? 'Sistema',
    role: session?.role ?? 'system',
  };
}

export function subscribeToAuditLogs(storeId, onData, onError) {
  if (!storeId || !canUseRemoteSync()) {
    onData([]);
    return () => {};
  }

  const auditQuery = query(getAuditLogsCollectionRef(storeId), orderBy('createdAt', 'desc'));

  return guardRemoteSubscription(
    () => onSnapshot(
      auditQuery,
      (snapshot) => {
        onData(snapshot.docs.map(mapSnapshot));
      },
      onError,
    ),
    {
      onFallback() {
        onData([]);
      },
      onError,
    },
  );
}

export async function createAuditLogEntry({
  storeId,
  tenantId,
  actor,
  action,
  entityType,
  entityId,
  description,
  metadata = null,
}) {
  assertFirebaseReady();

  if (!storeId) {
    throw new Error('Store obrigatoria para registrar audit log.');
  }

  if (!action?.trim()) {
    throw new Error('Acao obrigatoria para registrar audit log.');
  }

  if (!entityType?.trim()) {
    throw new Error('Tipo da entidade obrigatorio para registrar audit log.');
  }

  if (!entityId?.trim()) {
    throw new Error('Identificador da entidade obrigatorio para registrar audit log.');
  }

  if (!description?.trim()) {
    throw new Error('Descricao obrigatoria para registrar audit log.');
  }

  const actorPayload = {
    id: actor?.id ?? null,
    name: actor?.name?.trim() || 'Sistema',
    role: actor?.role ?? 'system',
  };

  const documentRef = await addDoc(getAuditLogsCollectionRef(storeId), {
    storeId,
    tenantId: tenantId ?? null,
    actor: actorPayload,
    action: action.trim(),
    entityType: entityType.trim(),
    entityId: entityId.trim(),
    description: description.trim(),
    metadata,
    createdAt: serverTimestamp(),
  });

  return documentRef.id;
}

export async function recordAuditLog(params) {
  try {
    const id = await createAuditLogEntry(params);
    return { ok: true, id };
  } catch (error) {
    console.error('Falha ao registrar audit log.', error);
    return { ok: false, error };
  }
}
