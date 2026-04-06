import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

import {
  assertRemoteSyncReady,
  canUseRemoteSync,
  firebaseDb,
  guardRemoteSubscription,
} from './firebase'
import { FIRESTORE_COLLECTIONS } from './firestoreCollections'

const OCCURRENCE_MALOTE_FLOW = 'malote'

function getOccurrenceMaloteCollectionRef(storeId) {
  assertRemoteSyncReady()
  return collection(
    firebaseDb,
    FIRESTORE_COLLECTIONS.stores,
    storeId,
    FIRESTORE_COLLECTIONS.occurrences,
  )
}

function getOccurrenceMaloteDocRef(storeId, entryId) {
  assertRemoteSyncReady()
  return doc(
    firebaseDb,
    FIRESTORE_COLLECTIONS.stores,
    storeId,
    FIRESTORE_COLLECTIONS.occurrences,
    entryId,
  )
}

function getLegacyOccurrenceMaloteCollectionRef(storeId) {
  assertRemoteSyncReady()
  return collection(
    firebaseDb,
    FIRESTORE_COLLECTIONS.stores,
    storeId,
    FIRESTORE_COLLECTIONS.financialOccurrences,
  )
}

function getLegacyOccurrenceMaloteDocRef(storeId, entryId) {
  assertRemoteSyncReady()
  return doc(
    firebaseDb,
    FIRESTORE_COLLECTIONS.stores,
    storeId,
    FIRESTORE_COLLECTIONS.financialOccurrences,
    entryId,
  )
}

function buildOccurrenceMaloteDocId(sourceRecordId) {
  const normalizedSourceRecordId = String(sourceRecordId ?? '').trim()

  if (normalizedSourceRecordId) {
    return `malote-${normalizedSourceRecordId}`
  }

  return `malote-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function mapOccurrenceMaloteSnapshot(snapshot) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? '')
  return `"${stringValue.replaceAll('"', '""')}"`
}

function formatDateTime(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '--'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function toIsoDateTime(value) {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function getActorName(session) {
  return session?.operatorName ?? session?.displayName ?? 'Operador local'
}

function normalizeRemoteItems(items = []) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.updatedAt ?? left.printedAt ?? left.createdAt ?? 0).getTime()
    const rightTime = new Date(right.updatedAt ?? right.printedAt ?? right.createdAt ?? 0).getTime()
    return rightTime - leftTime
  })
}

function buildProtocolCode() {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(
    2,
    '0',
  )}`
  return `MAL-${stamp}`
}

function getOccurrenceDescription(record) {
  return (
    String(record?.description ?? '').trim() ||
    String(record?.type ?? '').trim() ||
    'Ocorrencia operacional'
  )
}

async function migrateLegacyOccurrenceEntry(storeId, legacyEntry) {
  const entryId = String(legacyEntry?.id ?? '').trim()

  if (!entryId) {
    return
  }

  const nextPayload = {
    ...legacyEntry,
    flow: OCCURRENCE_MALOTE_FLOW,
    migratedFromCollection: FIRESTORE_COLLECTIONS.financialOccurrences,
    updatedAt: legacyEntry.updatedAt ?? serverTimestamp(),
  }

  await setDoc(getOccurrenceMaloteDocRef(storeId, entryId), nextPayload, { merge: true })
}

async function ensureLegacyMaloteHistoryMigrated(storeId) {
  if (!storeId || !canUseRemoteSync()) {
    return
  }

  const legacySnapshot = await getDocs(
    query(getLegacyOccurrenceMaloteCollectionRef(storeId), orderBy('updatedAt', 'desc')),
  )

  const legacyItems = legacySnapshot.docs
    .map(mapOccurrenceMaloteSnapshot)
    .filter((item) => item.flow === OCCURRENCE_MALOTE_FLOW)

  if (legacyItems.length === 0) {
    return
  }

  await Promise.all(legacyItems.map((item) => migrateLegacyOccurrenceEntry(storeId, item)))
}

async function readExistingOccurrenceMaloteData(storeId, entryId) {
  const currentSnapshot = await getDoc(getOccurrenceMaloteDocRef(storeId, entryId))

  if (currentSnapshot.exists()) {
    return currentSnapshot.data() ?? {}
  }

  const legacySnapshot = await getDoc(getLegacyOccurrenceMaloteDocRef(storeId, entryId))

  if (legacySnapshot.exists()) {
    const legacyData = legacySnapshot.data() ?? {}
    await migrateLegacyOccurrenceEntry(storeId, {
      id: entryId,
      ...legacyData,
    })
    return legacyData
  }

  return {}
}

export function getOccurrenceMaloteDefaultReceivedAt() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function subscribeToOccurrenceMaloteHistory(storeId, onData, onError) {
  if (!storeId || !canUseRemoteSync()) {
    onData([])
    return () => {}
  }

  void ensureLegacyMaloteHistoryMigrated(storeId).catch((error) => {
    onError?.(error)
  })

  const maloteQuery = query(getOccurrenceMaloteCollectionRef(storeId), orderBy('updatedAt', 'desc'))

  return guardRemoteSubscription(
    () =>
      onSnapshot(
        maloteQuery,
        (snapshot) => {
          const nextItems = snapshot.docs
            .map(mapOccurrenceMaloteSnapshot)
            .filter((item) => item.flow === OCCURRENCE_MALOTE_FLOW)

          onData(normalizeRemoteItems(nextItems))
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

export function buildOccurrenceMalotePrintPayload(entry, session) {
  return {
    documentTitle: 'Ocorrencia para malote',
    subtitle: 'Encaminhamento interno para Financeiro / RH',
    meta: String(entry?.status ?? '').trim() || 'Em triagem',
    destinationSector: entry?.destinationSector ?? 'Financeiro / RH',
    category: entry?.category ?? 'Ocorrencia operacional',
    title: entry?.title ?? `Ocorrencia ${entry?.reference ?? entry?.code ?? 'Sem codigo'}`,
    reference: entry?.reference ?? entry?.code ?? '',
    amount: entry?.amount ?? '',
    operatorName: entry?.operatorName ?? entry?.owner ?? getActorName(session),
    occurredAt: toIsoDateTime(
      entry?.occurredAt ?? entry?.createdAtClient ?? entry?.updatedAtClient,
    ),
    description: getOccurrenceDescription(entry),
    footer:
      entry?.protocolCode && entry?.receivedBy
        ? `Protocolo ${entry.protocolCode} - Recebido por ${entry.receivedBy}`
        : 'Documento para envio no malote interno.',
  }
}

export async function upsertOccurrenceMaloteEntry({ storeId, tenantId, record, session }) {
  if (!storeId) {
    throw new Error('Nenhuma store ativa disponivel para registrar o malote.')
  }

  assertRemoteSyncReady()

  const sourceRecordId = String(record?.id ?? '').trim()
  const entryId = buildOccurrenceMaloteDocId(sourceRecordId)
  const entryRef = getOccurrenceMaloteDocRef(storeId, entryId)
  const existingData = await readExistingOccurrenceMaloteData(storeId, entryId)
  const actorName = getActorName(session)
  const nowIso = new Date().toISOString()

  await setDoc(
    entryRef,
    {
      flow: OCCURRENCE_MALOTE_FLOW,
      storeId: storeId ?? null,
      tenantId: tenantId ?? null,
      sourceRecordId: sourceRecordId || null,
      code: String(record?.code ?? '').trim(),
      type: String(record?.type ?? '').trim(),
      owner: String(record?.owner ?? '').trim() || actorName,
      status: String(record?.status ?? '').trim() || 'Em triagem',
      description: getOccurrenceDescription(record),
      destinationSector: 'Financeiro / RH',
      category: 'Ocorrencia operacional',
      title: `Ocorrencia ${String(record?.code ?? '').trim() || 'sem codigo'}`,
      reference: String(record?.code ?? '').trim(),
      amount: '',
      operatorName: actorName,
      occurredAt: toIsoDateTime(
        record?.createdAtClient ?? record?.updatedAtClient ?? record?.occurredAt ?? nowIso,
      ),
      printedAt: nowIso,
      printCount: Number(existingData.printCount ?? 0) + 1,
      protocolCode: existingData.protocolCode ?? '',
      receivedBy: existingData.receivedBy ?? '',
      receivedAt: existingData.receivedAt ?? '',
      digitalSignature: existingData.digitalSignature ?? '',
      notes: existingData.notes ?? '',
      createdAt: existingData.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  return entryId
}

export async function syncOccurrenceMaloteStatus({ storeId, sourceRecordId, status }) {
  const normalizedSourceRecordId = String(sourceRecordId ?? '').trim()

  if (!storeId || !normalizedSourceRecordId || !canUseRemoteSync()) {
    return
  }

  const entryRef = getOccurrenceMaloteDocRef(
    storeId,
    buildOccurrenceMaloteDocId(normalizedSourceRecordId),
  )
  let existingSnapshot = await getDoc(entryRef)

  if (!existingSnapshot.exists()) {
    await readExistingOccurrenceMaloteData(
      storeId,
      buildOccurrenceMaloteDocId(normalizedSourceRecordId),
    )
    existingSnapshot = await getDoc(entryRef)
  }

  if (!existingSnapshot.exists()) {
    return
  }

  await updateDoc(entryRef, {
    status: String(status ?? '').trim() || existingSnapshot.data()?.status || 'Em triagem',
    updatedAt: serverTimestamp(),
  })
}

export async function attachOccurrenceMaloteReceipt({ storeId, entryId, values, session }) {
  const protocolCode = String(values?.protocolCode ?? '').trim() || buildProtocolCode()
  const receivedBy = String(values?.receivedBy ?? '').trim()
  const digitalSignature = String(values?.digitalSignature ?? '').trim()

  if (!receivedBy) {
    throw new Error('Informe quem recebeu o malote.')
  }

  if (!digitalSignature) {
    throw new Error('Informe a assinatura digital ou identificacao do recebimento.')
  }

  if (!storeId || !entryId) {
    throw new Error('Ocorrencia invalida para anexar protocolo.')
  }

  assertRemoteSyncReady()

  const entryRef = getOccurrenceMaloteDocRef(storeId, entryId)
  let existingSnapshot = await getDoc(entryRef)

  if (!existingSnapshot.exists()) {
    await readExistingOccurrenceMaloteData(storeId, entryId)
    existingSnapshot = await getDoc(entryRef)
  }

  if (!existingSnapshot.exists()) {
    throw new Error('Nao foi possivel localizar a ocorrencia do malote.')
  }

  await updateDoc(entryRef, {
    protocolCode,
    receivedBy,
    receivedAt: toIsoDateTime(values?.receivedAt || new Date().toISOString()),
    digitalSignature,
    notes: String(values?.notes ?? '').trim(),
    receiptActor: getActorName(session),
    updatedAt: serverTimestamp(),
  })
}

export function buildOccurrenceMaloteExcel(items = []) {
  const header = [
    'Destino',
    'Classificacao',
    'Titulo',
    'Referencia',
    'Valor impactado',
    'Operador responsavel',
    'Data informada',
    'Descricao detalhada',
    'Status do malote',
    'Protocolo',
    'Recebido por',
    'Recebido em',
    'Assinatura digital',
    'Observacoes',
  ]
  const rows = items.map((item) => [
    item.destinationSector ?? '',
    item.category ?? '',
    item.title ?? '',
    item.reference ?? item.code ?? '',
    item.amount ?? '',
    item.operatorName ?? item.owner ?? '',
    formatDateTime(item.occurredAt),
    getOccurrenceDescription(item),
    item.status ?? '',
    item.protocolCode ?? '',
    item.receivedBy ?? '',
    formatDateTime(item.receivedAt),
    item.digitalSignature ?? '',
    item.notes ?? '',
  ])

  const htmlRows = [header, ...rows]
    .map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`)
    .join('')

  return `<html><body><table>${htmlRows}</table></body></html>`
}

export function buildOccurrenceMaloteCsv(items = []) {
  const rows = [
    [
      'Destino',
      'Classificacao',
      'Titulo',
      'Referencia',
      'Valor impactado',
      'Operador responsavel',
      'Data informada',
      'Descricao detalhada',
      'Status do malote',
      'Protocolo',
      'Recebido por',
      'Recebido em',
      'Assinatura digital',
      'Observacoes',
    ],
    ...items.map((item) => [
      item.destinationSector ?? '',
      item.category ?? '',
      item.title ?? '',
      item.reference ?? item.code ?? '',
      item.amount ?? '',
      item.operatorName ?? item.owner ?? '',
      formatDateTime(item.occurredAt),
      getOccurrenceDescription(item),
      item.status ?? '',
      item.protocolCode ?? '',
      item.receivedBy ?? '',
      formatDateTime(item.receivedAt),
      item.digitalSignature ?? '',
      item.notes ?? '',
    ]),
  ]

  return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n')
}

export function buildOccurrenceMalotePdfHtml(items = []) {
  const cards = items
    .map(
      (item) => `
        <article class="malote-report__card">
          <header class="malote-report__header">
            <div>
              <p class="malote-report__eyebrow">${escapeHtml(item.destinationSector ?? 'Financeiro / RH')}</p>
              <h2 class="malote-report__title">${escapeHtml(item.title ?? 'Ocorrencia para malote')}</h2>
            </div>
            <span class="malote-report__status">${escapeHtml(item.status ?? 'Em triagem')}</span>
          </header>

          <section class="malote-report__summary">
            <div><span>Classificacao</span><strong>${escapeHtml(item.category ?? 'Ocorrencia operacional')}</strong></div>
            <div><span>Referencia</span><strong>${escapeHtml(item.reference ?? item.code ?? '--')}</strong></div>
            <div><span>Valor impactado</span><strong>${escapeHtml(item.amount ?? '--')}</strong></div>
            <div><span>Operador responsavel</span><strong>${escapeHtml(item.operatorName ?? item.owner ?? '--')}</strong></div>
            <div><span>Data informada</span><strong>${escapeHtml(formatDateTime(item.occurredAt))}</strong></div>
            <div><span>Protocolo</span><strong>${escapeHtml(item.protocolCode ?? 'Pendente')}</strong></div>
          </section>

          <section class="malote-report__description">
            <p class="malote-report__section-title">Descricao detalhada</p>
            <p>${escapeHtml(getOccurrenceDescription(item))}</p>
          </section>

          <footer class="malote-report__footer">
            <div><span>Recebido por</span><strong>${escapeHtml(item.receivedBy ?? 'Nao informado')}</strong></div>
            <div><span>Recebido em</span><strong>${escapeHtml(formatDateTime(item.receivedAt))}</strong></div>
            <div><span>Assinatura digital</span><strong>${escapeHtml(item.digitalSignature ?? 'Nao informada')}</strong></div>
            <div><span>Observacoes</span><strong>${escapeHtml(item.notes ?? '--')}</strong></div>
          </footer>
        </article>
      `,
    )
    .join('')

  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Historico de ocorrencias</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111827; background: #ffffff; }
        h1 { margin: 0 0 4px; font-size: 22px; }
        .malote-report__lead { color: #4b5563; margin: 0 0 20px; }
        .malote-report__list { display: grid; gap: 16px; }
        .malote-report__card { border: 1px solid #d1d5db; border-radius: 12px; padding: 16px; display: grid; gap: 14px; }
        .malote-report__header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; }
        .malote-report__eyebrow { margin: 0 0 4px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b7280; }
        .malote-report__title { margin: 0; font-size: 18px; }
        .malote-report__status { border: 1px solid #cbd5e1; border-radius: 999px; padding: 6px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
        .malote-report__summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; }
        .malote-report__summary div,
        .malote-report__footer div { display: grid; gap: 4px; }
        .malote-report__summary span,
        .malote-report__footer span,
        .malote-report__section-title { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; }
        .malote-report__summary strong,
        .malote-report__footer strong { font-size: 13px; }
        .malote-report__description { border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 12px 0; }
        .malote-report__description p:last-child { margin: 0; line-height: 1.55; white-space: pre-wrap; }
        .malote-report__footer { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; }
      </style>
    </head>
    <body>
      <h1>Historico de ocorrencias para malote</h1>
      <p class="malote-report__lead">Relatorio consolidado seguindo o mesmo modelo conceitual do papel operacional.</p>
      <section class="malote-report__list">${cards}</section>
    </body>
  </html>`
}
