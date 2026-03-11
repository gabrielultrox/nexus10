export const CHANNELS = ['BALCAO', 'ZE_DELIVERY', 'ANOTA_AI', 'IFOOD'];
export const PAYMENT_METHODS = ['DINHEIRO', 'ONLINE', 'CREDITO', 'DEBITO', 'PIX'];
export const ORDER_DOMAIN_STATUSES = ['OPEN', 'DISPATCHED', 'CONVERTED_TO_SALE', 'CANCELLED'];
export const ORDER_SALE_STATUSES = ['NOT_LAUNCHED', 'LAUNCHED'];
export const SALE_DOMAIN_STATUSES = ['POSTED', 'REVERSED', 'CANCELLED'];
export const SALE_SOURCES = ['DIRECT', 'ORDER'];

const channelLabels = {
  BALCAO: 'Balcao',
  ZE_DELIVERY: 'Ze Delivery',
  ANOTA_AI: 'Anota Ai',
  IFOOD: 'iFood',
};

const paymentMethodLabels = {
  DINHEIRO: 'Dinheiro',
  ONLINE: 'Online',
  CREDITO: 'Credito',
  DEBITO: 'Debito',
  PIX: 'Pix',
};

const orderDomainStatusLabels = {
  OPEN: 'Aberto',
  DISPATCHED: 'Despachado',
  CONVERTED_TO_SALE: 'Gerou venda',
  CANCELLED: 'Cancelado',
};

const saleDomainStatusLabels = {
  POSTED: 'Lançada',
  REVERSED: 'Estornada',
  CANCELLED: 'Cancelada',
};

const channelAliases = {
  balcao: 'BALCAO',
  'balcão': 'BALCAO',
  presencial: 'BALCAO',
  telefone: 'BALCAO',
  retirada: 'BALCAO',
  ze_delivery: 'ZE_DELIVERY',
  zedelivery: 'ZE_DELIVERY',
  'ze delivery': 'ZE_DELIVERY',
  'zé delivery': 'ZE_DELIVERY',
  anotai: 'ANOTA_AI',
  'anota ai': 'ANOTA_AI',
  anota_ai: 'ANOTA_AI',
  whatsapp: 'ANOTA_AI',
  ifood: 'IFOOD',
};

const paymentMethodAliases = {
  dinheiro: 'DINHEIRO',
  cash: 'DINHEIRO',
  online: 'ONLINE',
  app: 'ONLINE',
  credito: 'CREDITO',
  'crédito': 'CREDITO',
  credit: 'CREDITO',
  debito: 'DEBITO',
  'débito': 'DEBITO',
  debit: 'DEBITO',
  pix: 'PIX',
};

const orderDomainStatusAliases = {
  open: 'OPEN',
  opened: 'OPEN',
  received: 'OPEN',
  new: 'OPEN',
  created: 'OPEN',
  confirmed: 'OPEN',
  pending: 'OPEN',
  queued: 'OPEN',
  preparing: 'OPEN',
  in_preparation: 'OPEN',
  in_progress: 'OPEN',
  production: 'OPEN',
  dispatched: 'DISPATCHED',
  dispatching: 'DISPATCHED',
  out: 'DISPATCHED',
  on_route: 'DISPATCHED',
  out_for_delivery: 'DISPATCHED',
  delivered: 'DISPATCHED',
  converted_to_sale: 'CONVERTED_TO_SALE',
  converted: 'CONVERTED_TO_SALE',
  launched: 'CONVERTED_TO_SALE',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
  cancel: 'CANCELLED',
};

const saleDomainStatusAliases = {
  posted: 'POSTED',
  completed: 'POSTED',
  launched: 'POSTED',
  reversed: 'REVERSED',
  refunded: 'REVERSED',
  cancel: 'CANCELLED',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
};

const orderSaleStatusAliases = {
  not_launched: 'NOT_LAUNCHED',
  pending: 'NOT_LAUNCHED',
  launched: 'LAUNCHED',
};

export function normalizeToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeEnum(value, aliases, options, fallback = null) {
  const normalizedToken = normalizeToken(value);

  if (!normalizedToken) {
    return fallback;
  }

  const normalized = aliases[normalizedToken] ?? String(value ?? '').trim().toUpperCase();
  return options.includes(normalized) ? normalized : fallback;
}

export function normalizeChannel(value, fallback = null) {
  return normalizeEnum(value, channelAliases, CHANNELS, fallback);
}

export function normalizePaymentMethod(value, fallback = null) {
  return normalizeEnum(value, paymentMethodAliases, PAYMENT_METHODS, fallback);
}

export function normalizeOrderDomainStatus(value, fallback = 'OPEN') {
  return normalizeEnum(value, orderDomainStatusAliases, ORDER_DOMAIN_STATUSES, fallback);
}

export function normalizeOrderSaleStatus(value, fallback = 'NOT_LAUNCHED') {
  return normalizeEnum(value, orderSaleStatusAliases, ORDER_SALE_STATUSES, fallback);
}

export function normalizeSaleDomainStatus(value, fallback = 'POSTED') {
  return normalizeEnum(value, saleDomainStatusAliases, SALE_DOMAIN_STATUSES, fallback);
}

export function normalizeSaleSource(value, fallback = 'DIRECT') {
  return normalizeEnum(value, {}, SALE_SOURCES, fallback);
}

export function getChannelLabel(value) {
  const normalized = normalizeChannel(value);
  return normalized ? channelLabels[normalized] : 'Canal nao informado';
}

export function getPaymentMethodLabel(value) {
  const normalized = normalizePaymentMethod(value);
  return normalized ? paymentMethodLabels[normalized] : 'Nao informado';
}

export function getOrderDomainStatusLabel(value) {
  const normalized = normalizeOrderDomainStatus(value);
  return orderDomainStatusLabels[normalized] ?? orderDomainStatusLabels.OPEN;
}

export function getSaleDomainStatusLabel(value) {
  const normalized = normalizeSaleDomainStatus(value);
  return saleDomainStatusLabels[normalized] ?? saleDomainStatusLabels.POSTED;
}

export function mapOrderDomainStatusToLegacyBoardStatus(value) {
  switch (normalizeOrderDomainStatus(value)) {
    case 'DISPATCHED':
      return 'out_for_delivery';
    case 'CONVERTED_TO_SALE':
      return 'delivered';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'received';
  }
}

export function mapSaleDomainStatusToLegacyStatus(value) {
  switch (normalizeSaleDomainStatus(value)) {
    case 'CANCELLED':
      return 'canceled';
    case 'REVERSED':
      return 'refunded';
    default:
      return 'completed';
  }
}

export function isOrderClosedStatus(value) {
  const normalized = normalizeOrderDomainStatus(value);
  return normalized === 'CONVERTED_TO_SALE' || normalized === 'CANCELLED';
}

export function isSalePosted(value) {
  return normalizeSaleDomainStatus(value) === 'POSTED';
}

export function isSaleReversed(value) {
  return normalizeSaleDomainStatus(value) === 'REVERSED';
}

export function isSaleCancelled(value) {
  return normalizeSaleDomainStatus(value) === 'CANCELLED';
}

export function formatCurrencyBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

export function buildRecordCode(prefix) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `${prefix}-${year}${month}${day}-${hours}${minutes}-${suffix}`;
}
