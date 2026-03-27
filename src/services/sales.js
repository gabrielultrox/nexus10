import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore'

import { requestBackend } from './backendApi'
import {
  assertFirebaseReady,
  canUseRemoteSync,
  createRemoteSyncError,
  firebaseDb,
  guardRemoteSubscription,
} from './firebase'
import {
  buildStoreQueryCacheKey,
  getPaginatedStoreCollectionDocuments,
  invalidateQueryCache,
} from './firestore'
import {
  buildRecordCode,
  getChannelLabel,
  getPaymentMethodLabel,
  mapSaleDomainStatusToLegacyStatus,
  normalizeChannel,
  normalizePaymentMethod,
  normalizeSaleDomainStatus,
  normalizeSaleSource,
} from './commerce'
import { FIRESTORE_COLLECTIONS } from './firestoreCollections'

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
    throw new Error('A venda precisa ter ao menos um item.')
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

function getSalesCollectionRef(storeId) {
  assertFirebaseReady()
  return collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.sales)
}

function resolveSaleTotals(data) {
  const totals = data.totals ?? {}
  const subtotal = Number(totals.subtotal ?? data.subtotal ?? 0)
  const freight = Number(totals.freight ?? data.shipping ?? 0)
  const extraAmount = Number(totals.extraAmount ?? data.extraAmount ?? 0)
  const discountPercent = Number(totals.discountPercent ?? data.discountPercent ?? 0)
  const discountValue = Number(totals.discountValue ?? data.discount ?? 0)
  const total = Number(
    totals.total ?? data.total ?? subtotal + freight + extraAmount - discountValue,
  )

  return {
    subtotal,
    freight,
    extraAmount,
    discountPercent,
    discountValue,
    total,
  }
}

function parseDate(value) {
  if (!value) {
    return null
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function mapSnapshot(snapshot) {
  const data = snapshot.data()
  const domainStatus = normalizeSaleDomainStatus(data.status)
  const paymentMethod = normalizePaymentMethod(data.payment?.method ?? data.paymentMethod, null)
  const channel = normalizeChannel(data.channel ?? data.origin ?? data.sourceChannel, null)
  const totals = resolveSaleTotals(data)
  const items = Array.isArray(data.items)
    ? data.items.map((item) => ({
        ...item,
        name: item.productSnapshot?.name ?? item.name ?? 'Item',
        total: Number(item.totalPrice ?? item.total ?? 0),
      }))
    : []

  return {
    id: snapshot.id,
    ...data,
    code: data.code ?? snapshot.id,
    number: data.code?.trim() || `#${snapshot.id.slice(0, 6).toUpperCase()}`,
    source: normalizeSaleSource(data.source, data.orderId ? 'ORDER' : 'DIRECT'),
    channel,
    channelLabel: channel ? getChannelLabel(channel) : 'Canal nao informado',
    customerSnapshot: {
      id: data.customerSnapshot?.id ?? data.customerId ?? null,
      name: data.customerSnapshot?.name ?? 'Cliente avulso',
      phone: data.customerSnapshot?.phone ?? '',
      neighborhood: data.customerSnapshot?.neighborhood ?? '',
    },
    items,
    totals,
    payment: paymentMethod
      ? {
          method: paymentMethod,
          label: getPaymentMethodLabel(paymentMethod),
          amount: totals.total,
        }
      : null,
    paymentMethod,
    paymentMethodLabel: paymentMethod ? getPaymentMethodLabel(paymentMethod) : 'Nao informado',
    subtotal: totals.subtotal,
    shipping: totals.freight,
    discount: totals.discountValue,
    total: totals.total,
    domainStatus,
    status: mapSaleDomainStatusToLegacyStatus(domainStatus),
    stockPosted: Boolean(data.stockPosted),
    financialPosted: Boolean(data.financialPosted),
    createdAtDate: parseDate(data.createdAt),
    updatedAtDate: parseDate(data.updatedAt),
    launchedAtDate: parseDate(data.launchedAt),
  }
}

export function getSaleStatusMeta(status) {
  const normalized = normalizeSaleDomainStatus(status)

  switch (normalized) {
    case 'CANCELLED':
      return { label: 'Cancelada', badgeClass: 'ui-badge--danger' }
    case 'REVERSED':
      return { label: 'Estornada', badgeClass: 'ui-badge--warning' }
    default:
      return { label: 'Lancada', badgeClass: 'ui-badge--success' }
  }
}

export function validateSaleInput(values) {
  const channel = normalizeChannel(values.channel ?? values.origin ?? values.sourceChannel)

  if (!channel) {
    throw new Error('Informe o canal da venda.')
  }

  const paymentMethod = normalizePaymentMethod(values.payment?.method ?? values.paymentMethod)

  if (!paymentMethod) {
    throw new Error('Informe a forma de pagamento.')
  }

  const items = normalizeItems(values.items)
  const totals = normalizeTotals(items, values)
  const source = normalizeSaleSource(values.source, values.orderId ? 'ORDER' : 'DIRECT')

  return {
    code: values.code?.trim() || buildRecordCode('VEN'),
    orderId: values.orderId?.trim() || null,
    source,
    channel,
    channelLabel: getChannelLabel(channel),
    customerId: values.customerId?.trim() || values.customerSnapshot?.id || null,
    customerSnapshot: normalizeCustomerSnapshot(values),
    items,
    totals,
    payment: {
      method: paymentMethod,
      label: getPaymentMethodLabel(paymentMethod),
      amount: totals.total,
    },
    address: normalizeAddress(values),
    notes: values.notes?.trim() ?? '',
    status: normalizeSaleDomainStatus(values.status, 'POSTED'),
  }
}

export function subscribeToSales(storeId, onData, onError) {
  if (!storeId || !canUseRemoteSync()) {
    onData([])
    return () => {}
  }

  const salesQuery = query(getSalesCollectionRef(storeId), orderBy('createdAt', 'desc'))

  return guardRemoteSubscription(
    () =>
      onSnapshot(
        salesQuery,
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

export async function getSaleById({ storeId, saleId }) {
  if (!canUseRemoteSync()) {
    throw createRemoteSyncError()
  }

  assertFirebaseReady()
  const saleRef = doc(
    firebaseDb,
    FIRESTORE_COLLECTIONS.stores,
    storeId,
    FIRESTORE_COLLECTIONS.sales,
    saleId,
  )
  const snapshot = await getDoc(saleRef)

  if (!snapshot.exists()) {
    return null
  }

  return mapSnapshot(snapshot)
}

export async function createSale({ storeId, tenantId, values, createdBy = null }) {
  validateSaleInput(values)

  const data = await requestBackend(`/stores/${storeId}/sales`, {
    method: 'POST',
    body: {
      tenantId: tenantId ?? null,
      values,
      createdBy,
    },
  })

  invalidateQueryCache(buildStoreQueryCacheKey(storeId, FIRESTORE_COLLECTIONS.sales))
  return data.id
}

export async function createDirectSale({ storeId, tenantId, values, createdBy = null }) {
  return createSale({
    storeId,
    tenantId,
    createdBy,
    values: {
      ...values,
      source: 'DIRECT',
    },
  })
}

export async function createSaleFromOrder({
  storeId,
  tenantId,
  orderId,
  values = {},
  createdBy = null,
}) {
  const data = await requestBackend(`/stores/${storeId}/orders/${orderId}/sales`, {
    method: 'POST',
    body: {
      tenantId: tenantId ?? null,
      values,
      createdBy,
    },
  })

  invalidateQueryCache(buildStoreQueryCacheKey(storeId, FIRESTORE_COLLECTIONS.sales))
  return data.saleId
}

export async function listSalesPage({ storeId, pageSize = 50, cursor = null } = {}) {
  if (!storeId || !canUseRemoteSync()) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    }
  }

  return getPaginatedStoreCollectionDocuments(storeId, FIRESTORE_COLLECTIONS.sales, {
    orderField: 'createdAt',
    orderDirection: 'desc',
    pageSize,
    cursor,
    cacheKey: buildStoreQueryCacheKey(storeId, FIRESTORE_COLLECTIONS.sales, 'page-by-createdAt'),
  })
}

export async function deleteSale({ storeId, saleId }) {
  const data = await requestBackend(`/stores/${storeId}/sales/${saleId}`, {
    method: 'DELETE',
  })

  invalidateQueryCache(buildStoreQueryCacheKey(storeId, FIRESTORE_COLLECTIONS.sales))
  return data.id
}

export async function updateSaleStatus({ storeId, saleId, status, actor = null }) {
  const data = await requestBackend(`/stores/${storeId}/sales/${saleId}/status`, {
    method: 'PATCH',
    body: {
      status,
      actor,
      createdBy: actor,
    },
  })

  invalidateQueryCache(buildStoreQueryCacheKey(storeId, FIRESTORE_COLLECTIONS.sales))
  return data.id
}
