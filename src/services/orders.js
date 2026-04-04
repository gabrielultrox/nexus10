import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'

import { requestBackend } from './backendApi'
import {
  assertFirebaseReady,
  canUseRemoteSync,
  createRemoteSyncError,
  firebaseDb,
  guardRemoteSubscription,
} from './firebase'
import { createE2eOrder, getE2eOrderById, isE2eMode, subscribeE2eOrders } from './e2eRuntime'
import {
  buildStoreQueryCacheKey,
  getPaginatedStoreCollectionDocuments,
  invalidateQueryCache,
} from './firestore'
import { FIRESTORE_COLLECTIONS } from './firestoreCollections'
import {
  formatCurrencyBRL,
  getChannelLabel,
  getPaymentMethodLabel,
  buildRecordCode,
  mapOrderDomainStatusToLegacyBoardStatus,
  normalizeChannel,
  normalizeOrderDomainStatus,
  normalizeOrderSaleStatus,
  normalizePaymentMethod,
} from './commerce'

const orderStatusSequence = ['received', 'preparing', 'out_for_delivery', 'delivered']

function parseDomainMoney(value, fieldLabel) {
  const normalized = String(value ?? 0)
    .replace(/\s+/g, '')
    .replace(',', '.')
  const parsed = Number(normalized)

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} invalido.`)
  }

  return Number(parsed.toFixed(2))
}

function normalizeProductSnapshot(item, index) {
  const productName = item?.productSnapshot?.name?.trim() || item?.name?.trim()

  if (!productName) {
    throw new Error(`Item ${index + 1} sem nome.`)
  }

  return {
    id: item?.productSnapshot?.id ?? item?.productId ?? null,
    name: productName,
    category: item?.productSnapshot?.category ?? '',
    sku: item?.productSnapshot?.sku ?? '',
  }
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('O pedido precisa ter ao menos um item.')
  }

  return items.map((item, index) => {
    const quantity = Number(item?.quantity ?? 0)
    const unitPrice = Number(item?.unitPrice ?? 0)
    const productSnapshot = normalizeProductSnapshot(item, index)

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Quantidade invalida no item ${index + 1}.`)
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Preco invalido no item ${index + 1}.`)
    }

    return {
      productId: item?.productId ?? productSnapshot.id,
      productSnapshot,
      quantity,
      unitPrice: Number(unitPrice.toFixed(2)),
      totalPrice: Number((quantity * unitPrice).toFixed(2)),
    }
  })
}

function normalizeTotals(items, values) {
  const subtotalFromItems = Number(
    items.reduce((total, item) => total + Number(item.totalPrice ?? 0), 0).toFixed(2),
  )
  const totals = values?.totals ?? {}
  const freight = parseDomainMoney(
    totals.freight ?? values.freight ?? values.shipping ?? 0,
    'Frete',
  )
  const extraAmount = parseDomainMoney(totals.extraAmount ?? values.extraAmount ?? 0, 'Adicional')
  const discountPercent = parseDomainMoney(
    totals.discountPercent ?? values.discountPercent ?? 0,
    'Desconto percentual',
  )
  const discountValue = parseDomainMoney(
    totals.discountValue ?? values.discountValue ?? values.discount ?? 0,
    'Desconto',
  )
  const informedSubtotal =
    totals.subtotal != null ? parseDomainMoney(totals.subtotal, 'Subtotal') : subtotalFromItems

  if (Math.abs(informedSubtotal - subtotalFromItems) > 0.01) {
    throw new Error('Subtotal inconsistente com os itens informados.')
  }

  const expectedTotal = Number(
    (informedSubtotal + extraAmount + freight - discountValue).toFixed(2),
  )
  const informedTotal =
    totals.total != null
      ? parseDomainMoney(totals.total, 'Total')
      : parseDomainMoney(values.total ?? expectedTotal, 'Total')

  if (Math.abs(informedTotal - expectedTotal) > 0.01) {
    throw new Error('Total inconsistente com subtotal, frete, adicional e desconto.')
  }

  return {
    subtotal: informedSubtotal,
    freight,
    extraAmount,
    discountPercent,
    discountValue,
    total: informedTotal,
  }
}

function normalizeCustomerSnapshot(values) {
  const source = values.customerSnapshot ?? {}
  const name = source.name?.trim() || values.customerName?.trim() || 'Cliente avulso'

  return {
    id: source.id ?? values.customerId ?? null,
    name,
    phone: source.phone ?? values.customerPhone ?? '',
    neighborhood: source.neighborhood ?? values.neighborhood ?? '',
  }
}

function normalizeAddress(values) {
  const source = values.address ?? {}

  return {
    neighborhood: source.neighborhood ?? values.neighborhood ?? '',
    addressLine: source.addressLine ?? values.addressLine ?? '',
    reference: source.reference ?? values.reference ?? '',
    complement: source.complement ?? values.complement ?? '',
  }
}

function asDate(value) {
  if (!value) {
    return null
  }

  return typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
}

function parseMoney(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatTime(value) {
  const dateValue = asDate(value)

  if (!dateValue) {
    return '--:--'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateValue)
}

function formatDateTime(value) {
  const dateValue = asDate(value)

  if (!dateValue) {
    return 'Sem data'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateValue)
}

function formatWaitTime(value) {
  const dateValue = asDate(value)

  if (!dateValue) {
    return '--'
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - dateValue.getTime()) / 60000))

  if (diffMinutes < 60) {
    return `${diffMinutes} min`
  }

  const hours = Math.floor(diffMinutes / 60)
  const minutes = diffMinutes % 60
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

function normalizePriority(rawOrder, createdAt) {
  const rawPriority = String(rawOrder.priority ?? '')
    .trim()
    .toLowerCase()

  if (rawPriority === 'high' || rawPriority === 'urgent') {
    return 'high'
  }

  if (!createdAt) {
    return 'normal'
  }

  return (Date.now() - createdAt.getTime()) / 60000 >= 35 ? 'high' : 'normal'
}

function buildItemsSummary(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'Itens nao informados'
  }

  const summary = items
    .slice(0, 3)
    .map((item) => {
      const quantity = Number(item?.quantity ?? 0)
      const name = item?.productSnapshot?.name?.trim() || item?.name?.trim() || 'Item'
      return quantity > 0 ? `${quantity}x ${name}` : name
    })
    .join(' | ')

  return items.length > 3 ? `${summary} +${items.length - 3}` : summary
}

function sortOrders(records) {
  return [...records].sort((left, right) => {
    const leftDate = left.updatedAt?.getTime?.() ?? left.createdAt?.getTime?.() ?? 0
    const rightDate = right.updatedAt?.getTime?.() ?? right.createdAt?.getTime?.() ?? 0
    return rightDate - leftDate
  })
}

function getOrdersCollectionRef(storeId) {
  assertFirebaseReady()
  return collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.orders)
}

function normalizeOrderRecord(id, data, { isExternal = false } = {}) {
  const createdAt = asDate(data.createdAt)
  const updatedAt = asDate(data.updatedAt) ?? createdAt
  const domainStatus = normalizeOrderDomainStatus(data.status)
  const status = mapOrderDomainStatusToLegacyBoardStatus(domainStatus)
  const saleStatus = normalizeOrderSaleStatus(
    data.saleStatus,
    data.saleId ? 'LAUNCHED' : 'NOT_LAUNCHED',
  )
  const channel = normalizeChannel(data.source ?? data.origin, null)
  const paymentMethod = normalizePaymentMethod(
    data.paymentPreview?.method ?? data.paymentMethod ?? data.payment?.method,
    null,
  )
  const totalAmount = parseMoney(data.totals?.total ?? data.total)
  const customerName = data.customerSnapshot?.name?.trim() || data.customerName?.trim() || 'Cliente'
  const neighborhood =
    data.address?.neighborhood?.trim() ||
    data.customerSnapshot?.neighborhood?.trim() ||
    data.neighborhood?.trim() ||
    'Bairro nao informado'
  const courierName =
    data.courierSnapshot?.name?.trim() ||
    data.courierName?.trim() ||
    data.assignedCourierName?.trim() ||
    'Nao atribuido'

  return {
    id,
    ...data,
    status,
    domainStatus,
    saleStatus,
    sourceChannel: channel,
    source: channel ? getChannelLabel(channel) : 'Nao informado',
    origin: channel ? getChannelLabel(channel) : (data.origin ?? 'Nao informado'),
    paymentMethod,
    paymentMethodLabel: paymentMethod ? getPaymentMethodLabel(paymentMethod) : 'Nao informado',
    priority: normalizePriority(data, createdAt),
    number: data.code?.trim() || data.number?.trim() || `#${id.slice(0, 6).toUpperCase()}`,
    customerName,
    neighborhood,
    courierName,
    itemsSummary: buildItemsSummary(data.items),
    totalAmount,
    total: formatCurrencyBRL(totalAmount),
    time: formatTime(createdAt),
    waitTime: formatWaitTime(createdAt),
    createdAt,
    createdAtLabel: formatDateTime(createdAt),
    updatedAt,
    updatedAtLabel: formatDateTime(updatedAt),
    isExternal,
    timeline: Array.isArray(data.timeline) ? data.timeline : [],
    tracking: Array.isArray(data.tracking) ? data.tracking : [],
    externalStatus: data.externalStatus ?? null,
    normalizedStatus: status,
    syncErrorMessage: data.sync?.lastSyncError ?? null,
  }
}

function normalizeOrder(documentSnapshot) {
  return normalizeOrderRecord(documentSnapshot.id, documentSnapshot.data())
}

export function subscribeToOrders(storeId, onData, onError) {
  if (isE2eMode()) {
    return subscribeE2eOrders(storeId, onData)
  }

  if (!storeId || !canUseRemoteSync()) {
    onData([])
    return () => {}
  }

  const ordersQuery = query(getOrdersCollectionRef(storeId), orderBy('createdAt', 'desc'))

  return guardRemoteSubscription(
    () =>
      onSnapshot(
        ordersQuery,
        (snapshot) => {
          onData(sortOrders(snapshot.docs.map(normalizeOrder)))
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

export function getNextOrderStatus(currentStatus) {
  const currentIndex = orderStatusSequence.indexOf(currentStatus)

  if (currentIndex === -1 || currentIndex === orderStatusSequence.length - 1) {
    return null
  }

  return orderStatusSequence[currentIndex + 1]
}

export async function getOrderById({ storeId, orderId }) {
  if (isE2eMode()) {
    return getE2eOrderById({ storeId, orderId })
  }

  if (!canUseRemoteSync()) {
    throw createRemoteSyncError()
  }

  assertFirebaseReady()

  const orderRef = doc(
    firebaseDb,
    FIRESTORE_COLLECTIONS.stores,
    storeId,
    FIRESTORE_COLLECTIONS.orders,
    orderId,
  )
  const snapshot = await getDoc(orderRef)

  if (!snapshot.exists()) {
    return null
  }

  return normalizeOrder(snapshot)
}

export async function createOrder({ storeId, tenantId, values, createdBy = null }) {
  if (isE2eMode()) {
    return createE2eOrder({ storeId, tenantId, values, createdBy })
  }

  const data = await requestBackend(`/stores/${storeId}/orders`, {
    method: 'POST',
    body: {
      tenantId: tenantId ?? null,
      values,
      createdBy,
    },
  })

  invalidateQueryCache(buildStoreQueryCacheKey(storeId, FIRESTORE_COLLECTIONS.orders))
  return data.id
}

export async function updateOrder({ storeId, orderId, values }) {
  const data = await requestBackend(`/stores/${storeId}/orders/${orderId}`, {
    method: 'PATCH',
    body: {
      values,
    },
  })

  invalidateQueryCache(buildStoreQueryCacheKey(storeId, FIRESTORE_COLLECTIONS.orders))
  return data.id
}

export async function markOrderAsDispatched({ storeId, orderId }) {
  await requestBackend(`/stores/${storeId}/orders/${orderId}/dispatch`, {
    method: 'POST',
  })

  invalidateQueryCache(buildStoreQueryCacheKey(storeId, FIRESTORE_COLLECTIONS.orders))
}

export async function convertOrderToSale({
  storeId,
  tenantId,
  orderId,
  values = {},
  createdBy = null,
}) {
  const data = await requestBackend(`/stores/${storeId}/orders/${orderId}/convert-to-sale`, {
    method: 'POST',
    body: {
      tenantId: tenantId ?? null,
      values,
      createdBy,
    },
  })

  invalidateQueryCache(buildStoreQueryCacheKey(storeId, FIRESTORE_COLLECTIONS.orders))
  return data.saleId
}

export async function listOrdersPage({ storeId, pageSize = 50, cursor = null } = {}) {
  if (!storeId || !canUseRemoteSync()) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    }
  }

  return getPaginatedStoreCollectionDocuments(storeId, FIRESTORE_COLLECTIONS.orders, {
    orderField: 'createdAt',
    orderDirection: 'desc',
    pageSize,
    cursor,
    cacheKey: buildStoreQueryCacheKey(storeId, FIRESTORE_COLLECTIONS.orders, 'page-by-createdAt'),
  })
}

export async function deleteOrder({ storeId, orderId }) {
  const data = await requestBackend(`/stores/${storeId}/orders/${orderId}`, {
    method: 'DELETE',
  })

  invalidateQueryCache(buildStoreQueryCacheKey(storeId, FIRESTORE_COLLECTIONS.orders))
  return data.id
}

export async function updateOrderStatus({ storeId, orderId, status }) {
  const allowedStatuses = new Set([
    ...orderStatusSequence,
    'cancelled',
    'OPEN',
    'DISPATCHED',
    'CONVERTED_TO_SALE',
    'CANCELLED',
  ])

  if (!allowedStatuses.has(status)) {
    throw new Error('Status de pedido invalido.')
  }

  if (!canUseRemoteSync()) {
    throw createRemoteSyncError()
  }

  assertFirebaseReady()
  const orderRef = doc(
    firebaseDb,
    FIRESTORE_COLLECTIONS.stores,
    storeId,
    FIRESTORE_COLLECTIONS.orders,
    orderId,
  )

  await updateDoc(orderRef, {
    status,
    updatedAt: serverTimestamp(),
  })

  invalidateQueryCache(buildStoreQueryCacheKey(storeId, FIRESTORE_COLLECTIONS.orders))
}

export function validateOrderInput(values) {
  const source = normalizeChannel(values.source ?? values.channel)

  if (!source) {
    throw new Error('Informe o canal do pedido.')
  }

  const items = normalizeItems(values.items)
  const totals = normalizeTotals(items, values)
  const paymentMethod = normalizePaymentMethod(
    values.paymentPreview?.method ?? values.paymentMethod ?? values.payment?.method,
  )

  if (!paymentMethod) {
    throw new Error('Informe a forma de pagamento do pedido.')
  }

  return {
    code: values.code?.trim() || buildRecordCode('PED'),
    source,
    sourceLabel: getChannelLabel(source),
    customerId: values.customerId?.trim() || values.customerSnapshot?.id || null,
    customerSnapshot: normalizeCustomerSnapshot(values),
    items,
    totals,
    paymentPreview: {
      method: paymentMethod,
      label: getPaymentMethodLabel(paymentMethod),
      amount: totals.total,
    },
    address: normalizeAddress(values),
    notes: values.notes?.trim() ?? '',
    status: normalizeOrderDomainStatus(values.status, 'OPEN'),
    saleStatus: normalizeOrderSaleStatus(values.saleStatus, 'NOT_LAUNCHED'),
    saleId: values.saleId?.trim() || null,
  }
}
