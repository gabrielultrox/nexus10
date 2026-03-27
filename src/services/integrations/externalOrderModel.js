function asIsoString(value) {
  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString()
  }

  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString()
}

function asNumber(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeItems(items = []) {
  if (!Array.isArray(items)) {
    return []
  }

  return items.map((item, index) => ({
    id: item?.id ?? item?.uniqueId ?? `item-${index + 1}`,
    name: item?.name?.trim() || 'Item',
    quantity: asNumber(item?.quantity ?? 1),
    unitPrice: asNumber(item?.unitPrice ?? item?.price?.value),
    totalPrice: asNumber(
      item?.totalPrice ??
        item?.total?.value ??
        asNumber(item?.quantity ?? 1) * asNumber(item?.unitPrice ?? item?.price?.value),
    ),
    options: Array.isArray(item?.options) ? item.options : [],
    notes: item?.notes?.trim?.() ?? '',
  }))
}

export function buildExternalOrderDocumentId(source, merchantId, externalOrderId) {
  return [source, merchantId, externalOrderId].filter(Boolean).join(':')
}

export function normalizeExternalOrderRecord(order = {}) {
  return {
    externalOrderId: String(order.externalOrderId ?? order.id ?? '').trim(),
    source: String(order.source ?? '')
      .trim()
      .toLowerCase(),
    merchantId: String(order.merchantId ?? '').trim(),
    displayId: String(order.displayId ?? order.orderNumber ?? '').trim(),
    customer: order.customer ?? {
      name: '',
      phone: '',
      documentNumber: '',
      address: null,
    },
    items: normalizeItems(order.items),
    subtotal: asNumber(order.subtotal),
    discount: asNumber(order.discount),
    shipping: asNumber(order.shipping),
    total: asNumber(order.total),
    paymentMethod: String(order.paymentMethod ?? '').trim(),
    externalStatus: String(order.externalStatus ?? '').trim(),
    normalizedStatus: String(order.normalizedStatus ?? '').trim(),
    salesChannel: String(order.salesChannel ?? '').trim(),
    category: String(order.category ?? '').trim(),
    tracking: Array.isArray(order.tracking) ? order.tracking : [],
    timeline: Array.isArray(order.timeline) ? order.timeline : [],
    sync: {
      lastEventId: order.sync?.lastEventId ?? null,
      lastSyncAt: asIsoString(order.sync?.lastSyncAt ?? order.updatedAt),
      lastSyncError: order.sync?.lastSyncError ?? null,
      duplicateEventCount: asNumber(order.sync?.duplicateEventCount),
    },
    createdAt: asIsoString(order.createdAt),
    updatedAt: asIsoString(order.updatedAt),
    raw: order.raw ?? null,
  }
}

export function buildExternalOrderTimelineEntry({
  eventId,
  code,
  fullCode,
  label,
  description,
  happenedAt,
  metadata = null,
}) {
  return {
    id: eventId ?? `${code ?? fullCode ?? 'event'}-${Date.now()}`,
    code: code ?? null,
    fullCode: fullCode ?? null,
    label: label ?? fullCode ?? code ?? 'Evento',
    description: description ?? '',
    happenedAt: asIsoString(happenedAt) ?? new Date().toISOString(),
    metadata,
  }
}

export function buildExternalOrderTrackingEntry({
  trackingId,
  externalOrderId,
  merchantId,
  source,
  status,
  label,
  description,
  happenedAt,
  eventId = null,
  location = null,
}) {
  return {
    id: trackingId ?? `${source}:${merchantId}:${externalOrderId}:${status}:${Date.now()}`,
    source,
    externalOrderId,
    merchantId,
    status,
    label,
    description: description ?? '',
    happenedAt: asIsoString(happenedAt) ?? new Date().toISOString(),
    eventId,
    location,
  }
}
