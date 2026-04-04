export const channelOptions = ['BALCAO', 'ANOTA_AI']
export const paymentOptions = ['DINHEIRO', 'ONLINE', 'CREDITO', 'DEBITO', 'PIX']

export function createEmptyItem() {
  return {
    productId: '',
    productSnapshot: null,
    quantity: '1',
    unitPrice: '',
  }
}

export function createInitialFormState() {
  return {
    channel: 'BALCAO',
    customerId: '',
    paymentMethod: 'PIX',
    notes: '',
    address: {
      neighborhood: '',
      addressLine: '',
      reference: '',
      complement: '',
    },
    totals: {
      freight: '0',
      extraAmount: '0',
      discountPercent: '0',
      discountValue: '0',
    },
    items: [createEmptyItem()],
  }
}

export function asDate(value) {
  if (!value) {
    return null
  }

  return typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
}

export function formatDateTime(value) {
  const dateValue = asDate(value)

  if (!dateValue || Number.isNaN(dateValue.getTime())) {
    return '--'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateValue)
}

export function isWithinPeriod(createdAt, startDate, endDate) {
  const value = asDate(createdAt)

  if (!value || Number.isNaN(value.getTime())) {
    return false
  }

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`)
    if (value < start) {
      return false
    }
  }

  if (endDate) {
    const end = new Date(`${endDate}T23:59:59`)
    if (value > end) {
      return false
    }
  }

  return true
}

export function parseDecimal(value) {
  const normalized = String(value ?? '')
    .replace(/\s+/g, '')
    .replace(',', '.')
  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : 0
}
