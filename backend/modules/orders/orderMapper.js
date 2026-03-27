import {
  getChannelLabel,
  getPaymentMethodLabel,
  normalizeOrderSaleStatus,
  normalizeOrderStatus,
} from './orderValidationService.js'

function serializeDate(value) {
  if (!value) {
    return null
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString()
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function mapOrderResponse(snapshot) {
  if (!snapshot) {
    return null
  }

  const { id, data } = snapshot

  return {
    id,
    ...data,
    status: normalizeOrderStatus(data.status, 'OPEN'),
    saleStatus: normalizeOrderSaleStatus(
      data.saleStatus,
      data.saleId ? 'LAUNCHED' : 'NOT_LAUNCHED',
    ),
    sourceLabel: data.sourceLabel ?? getChannelLabel(data.source),
    paymentPreview: data.paymentPreview
      ? {
          ...data.paymentPreview,
          label: data.paymentPreview.label ?? getPaymentMethodLabel(data.paymentPreview.method),
        }
      : null,
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt),
  }
}
