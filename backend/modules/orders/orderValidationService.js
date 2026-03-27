const CHANNELS = ['BALCAO', 'ZE_DELIVERY', 'ANOTA_AI', 'IFOOD']
const PAYMENT_METHODS = ['DINHEIRO', 'ONLINE', 'CREDITO', 'DEBITO', 'PIX']
const ORDER_STATUSES = ['OPEN', 'DISPATCHED', 'CONVERTED_TO_SALE', 'CANCELLED']
const ORDER_SALE_STATUSES = ['NOT_LAUNCHED', 'LAUNCHED']

const channelLabels = {
  BALCAO: 'Balcao',
  ZE_DELIVERY: 'Ze Delivery',
  ANOTA_AI: 'Anota Ai',
  IFOOD: 'iFood',
}

const paymentMethodLabels = {
  DINHEIRO: 'Dinheiro',
  ONLINE: 'Online',
  CREDITO: 'Credito',
  DEBITO: 'Debito',
  PIX: 'Pix',
}

const channelAliases = {
  balcao: 'BALCAO',
  presencial: 'BALCAO',
  retirada: 'BALCAO',
  telefone: 'BALCAO',
  ze_delivery: 'ZE_DELIVERY',
  zedelivery: 'ZE_DELIVERY',
  'ze delivery': 'ZE_DELIVERY',
  anotai: 'ANOTA_AI',
  anota_ai: 'ANOTA_AI',
  'anota ai': 'ANOTA_AI',
  whatsapp: 'ANOTA_AI',
  ifood: 'IFOOD',
}

const paymentMethodAliases = {
  dinheiro: 'DINHEIRO',
  cash: 'DINHEIRO',
  online: 'ONLINE',
  app: 'ONLINE',
  credito: 'CREDITO',
  credit: 'CREDITO',
  debito: 'DEBITO',
  debit: 'DEBITO',
  pix: 'PIX',
}

const orderStatusAliases = {
  open: 'OPEN',
  opened: 'OPEN',
  pending: 'OPEN',
  received: 'OPEN',
  new: 'OPEN',
  dispatched: 'DISPATCHED',
  dispatching: 'DISPATCHED',
  out_for_delivery: 'DISPATCHED',
  delivered: 'DISPATCHED',
  converted_to_sale: 'CONVERTED_TO_SALE',
  converted: 'CONVERTED_TO_SALE',
  launched: 'CONVERTED_TO_SALE',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
}

const orderSaleStatusAliases = {
  not_launched: 'NOT_LAUNCHED',
  pending: 'NOT_LAUNCHED',
  launched: 'LAUNCHED',
}

export function createOrderError(message, statusCode = 400, code = 'ORDER_ERROR') {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  return error
}

function normalizeToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeEnum(value, aliases, options, fallback = null) {
  const normalizedToken = normalizeToken(value)

  if (!normalizedToken) {
    return fallback
  }

  const normalizedValue =
    aliases[normalizedToken] ??
    String(value ?? '')
      .trim()
      .toUpperCase()
  return options.includes(normalizedValue) ? normalizedValue : fallback
}

export function normalizeChannel(value, fallback = null) {
  return normalizeEnum(value, channelAliases, CHANNELS, fallback)
}

export function normalizePaymentMethod(value, fallback = null) {
  return normalizeEnum(value, paymentMethodAliases, PAYMENT_METHODS, fallback)
}

export function normalizeOrderStatus(value, fallback = 'OPEN') {
  return normalizeEnum(value, orderStatusAliases, ORDER_STATUSES, fallback)
}

export function normalizeOrderSaleStatus(value, fallback = 'NOT_LAUNCHED') {
  return normalizeEnum(value, orderSaleStatusAliases, ORDER_SALE_STATUSES, fallback)
}

export function getChannelLabel(value) {
  const normalized = normalizeChannel(value)
  return normalized ? channelLabels[normalized] : 'Canal nao informado'
}

export function getPaymentMethodLabel(value) {
  const normalized = normalizePaymentMethod(value)
  return normalized ? paymentMethodLabels[normalized] : 'Nao informado'
}

export function buildRecordCode(prefix) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()

  return `${prefix}-${year}${month}${day}-${hours}${minutes}-${suffix}`
}

function parseMoney(value, fieldLabel) {
  const normalized = String(value ?? 0)
    .replace(/\s+/g, '')
    .replace(',', '.')
  const parsed = Number(normalized)

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw createOrderError(`${fieldLabel} invalido.`)
  }

  return Number(parsed.toFixed(2))
}

function normalizeProductSnapshot(item, index) {
  const productName = item?.productSnapshot?.name?.trim() || item?.name?.trim()

  if (!productName) {
    throw createOrderError(`Item ${index + 1} sem nome.`)
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
    throw createOrderError('O pedido precisa ter ao menos um item.')
  }

  return items.map((item, index) => {
    const quantity = Number(item?.quantity ?? 0)
    const unitPrice = Number(item?.unitPrice ?? 0)
    const productSnapshot = normalizeProductSnapshot(item, index)

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw createOrderError(`Quantidade invalida no item ${index + 1}.`)
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw createOrderError(`Preco invalido no item ${index + 1}.`)
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
  const freight = parseMoney(totals.freight ?? values.freight ?? values.shipping ?? 0, 'Frete')
  const extraAmount = parseMoney(totals.extraAmount ?? values.extraAmount ?? 0, 'Adicional')
  const discountPercent = parseMoney(
    totals.discountPercent ?? values.discountPercent ?? 0,
    'Desconto percentual',
  )
  const discountValue = parseMoney(
    totals.discountValue ?? values.discountValue ?? values.discount ?? 0,
    'Desconto',
  )
  const informedSubtotal =
    totals.subtotal != null ? parseMoney(totals.subtotal, 'Subtotal') : subtotalFromItems

  if (Math.abs(informedSubtotal - subtotalFromItems) > 0.01) {
    throw createOrderError('Subtotal inconsistente com os itens informados.')
  }

  const expectedTotal = Number(
    (informedSubtotal + extraAmount + freight - discountValue).toFixed(2),
  )
  const informedTotal =
    totals.total != null
      ? parseMoney(totals.total, 'Total')
      : parseMoney(values.total ?? expectedTotal, 'Total')

  if (Math.abs(informedTotal - expectedTotal) > 0.01) {
    throw createOrderError('Total inconsistente com subtotal, frete, adicional e desconto.')
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

export function buildCreatedBy(createdBy) {
  return {
    id: createdBy?.id ?? createdBy?.uid ?? null,
    name: createdBy?.name ?? createdBy?.operatorName ?? createdBy?.displayName ?? 'Operador local',
    role: createdBy?.role ?? 'operator',
  }
}

export function validateStoreId(storeId) {
  if (!String(storeId ?? '').trim()) {
    throw createOrderError('storeId e obrigatorio.')
  }
}

export function validateOrderInput(values = {}) {
  const source = normalizeChannel(values.source ?? values.channel)

  if (!source) {
    throw createOrderError('Informe o canal do pedido.')
  }

  const items = normalizeItems(values.items)
  const totals = normalizeTotals(items, values)
  const paymentMethod = normalizePaymentMethod(
    values.paymentPreview?.method ?? values.paymentMethod ?? values.payment?.method,
  )

  if (!paymentMethod) {
    throw createOrderError('Informe a forma de pagamento do pedido.')
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
    status: normalizeOrderStatus(values.status, 'OPEN'),
    saleStatus: normalizeOrderSaleStatus(values.saleStatus, 'NOT_LAUNCHED'),
    saleId: values.saleId?.trim() || null,
  }
}
