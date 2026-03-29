import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'

import {
  assertFirebaseReady,
  canUseRemoteSync,
  firebaseDb,
  guardRemoteSubscription,
} from './firebase'
import { FIRESTORE_COLLECTIONS } from './firestoreCollections'

function getAuditLogsCollectionRef(storeId) {
  assertFirebaseReady()
  return collection(
    firebaseDb,
    FIRESTORE_COLLECTIONS.stores,
    storeId,
    FIRESTORE_COLLECTIONS.auditLogs,
  )
}

function mapSnapshot(snapshot) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  }
}

function sanitizeValue(value) {
  if (value == null) {
    return null
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

function getTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function buildLocalTimestamp(date = new Date(), timezone = getTimezone()) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year ?? '0000'}-${map.month ?? '00'}-${map.day ?? '00'}T${map.hour ?? '00'}:${map.minute ?? '00'}:${map.second ?? '00'}`
}

export function buildAuditActor(session) {
  return {
    id: session?.uid ?? null,
    name: session?.operatorName ?? session?.displayName ?? 'Sistema',
    role: session?.role ?? 'system',
  }
}

export function subscribeToAuditLogs(storeId, onData, onError) {
  if (!storeId || !canUseRemoteSync()) {
    onData([])
    return () => {}
  }

  const auditQuery = query(getAuditLogsCollectionRef(storeId), orderBy('createdAt', 'desc'))

  return guardRemoteSubscription(
    () =>
      onSnapshot(
        auditQuery,
        (snapshot) => {
          onData(snapshot.docs.map(mapSnapshot))
        },
        onError,
      ),
    {
      onFallback() {
        onData([])
      },
      onError,
    },
  )
}

export async function createAuditLogEntry({
  storeId,
  tenantId,
  actor,
  action,
  module = '',
  entityType,
  entityId,
  description,
  reason = null,
  before = null,
  after = null,
  metadata = null,
  notifyAdmin = false,
}) {
  assertFirebaseReady()

  if (!storeId) {
    throw new Error('Store obrigatoria para registrar audit log.')
  }

  if (!action?.trim()) {
    throw new Error('Acao obrigatoria para registrar audit log.')
  }

  if (!entityType?.trim()) {
    throw new Error('Tipo da entidade obrigatorio para registrar audit log.')
  }

  if (!entityId?.trim()) {
    throw new Error('Identificador da entidade obrigatorio para registrar audit log.')
  }

  if (!description?.trim()) {
    throw new Error('Descricao obrigatoria para registrar audit log.')
  }

  const now = new Date()
  const timezone = getTimezone()
  const actorPayload = {
    id: actor?.id ?? null,
    name: actor?.name?.trim() || 'Sistema',
    role: actor?.role ?? 'system',
  }

  const documentRef = await addDoc(getAuditLogsCollectionRef(storeId), {
    storeId,
    tenantId: tenantId ?? null,
    userId: actorPayload.id,
    actor: actorPayload,
    action: action.trim(),
    module: module.trim() || entityType.trim(),
    entityType: entityType.trim(),
    entityId: entityId.trim(),
    description: description.trim(),
    reason: typeof reason === 'string' ? reason.trim() || null : null,
    before: sanitizeValue(before),
    after: sanitizeValue(after),
    metadata: sanitizeValue(metadata) ?? {},
    notifyAdmin: Boolean(notifyAdmin),
    timezone,
    timestampUtc: now.toISOString(),
    timestampLocal: buildLocalTimestamp(now, timezone),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return documentRef.id
}

export async function recordAuditLog(params) {
  try {
    const id = await createAuditLogEntry(params)
    return { ok: true, id }
  } catch (error) {
    console.error('Falha ao registrar audit log.', error)
    return { ok: false, error }
  }
}
