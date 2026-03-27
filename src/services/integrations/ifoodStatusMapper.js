const ifoodEventStatusMap = {
  PLC: 'received',
  PLACED: 'received',
  CFM: 'preparing',
  CONFIRMED: 'preparing',
  SPS: 'preparing',
  SEPARATION_STARTED: 'preparing',
  SPE: 'preparing',
  SEPARATION_ENDED: 'preparing',
  RTP: 'preparing',
  READY_TO_PICKUP: 'preparing',
  DSP: 'out_for_delivery',
  DISPATCHED: 'out_for_delivery',
  CON: 'delivered',
  CONCLUDED: 'delivered',
  CAN: 'cancelled',
  CANCELLED: 'cancelled',
}

const ifoodEventGroupMap = {
  ORDER_STATUS: 'status',
  DELIVERY: 'tracking',
  DELIVERY_ADDRESS: 'delivery_address',
  DELIVERY_GROUP: 'delivery_group',
  DELIVERY_ONDEMAND: 'delivery_ondemand',
  DELIVERY_COMPLEMENT: 'delivery_complement',
  CANCELLATION_REQUEST: 'cancellation_request',
  ORDER_TAKEOUT: 'takeout',
  ORDER_HANDSHAKE: 'handshake',
}

const normalizedStatusLabels = {
  received: 'Recebido',
  preparing: 'Preparando',
  out_for_delivery: 'Saiu para entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  unknown: 'Pendente de mapeamento',
}

export function mapIfoodEventGroup(eventGroup) {
  const normalizedGroup = String(eventGroup ?? '')
    .trim()
    .toUpperCase()
  return ifoodEventGroupMap[normalizedGroup] ?? 'other'
}

export function mapIfoodStatus(rawStatus) {
  const normalizedKey = String(rawStatus ?? '')
    .trim()
    .toUpperCase()
  return ifoodEventStatusMap[normalizedKey] ?? 'unknown'
}

export function getNormalizedStatusLabel(status) {
  return normalizedStatusLabels[status] ?? normalizedStatusLabels.unknown
}

export function shouldCreateTrackingEntry(event = {}) {
  return (
    ['DSP', 'DISPATCHED', 'CON', 'CONCLUDED'].includes(
      String(event.code ?? event.fullCode ?? '')
        .trim()
        .toUpperCase(),
    ) || mapIfoodEventGroup(event.group ?? event.eventGroup) === 'tracking'
  )
}

export function resolveIfoodEventDescriptor(event = {}) {
  const eventCode = String(event.code ?? '')
    .trim()
    .toUpperCase()
  const fullCode = String(event.fullCode ?? '')
    .trim()
    .toUpperCase()
  const normalizedStatus = mapIfoodStatus(eventCode || fullCode)

  return {
    eventCode,
    fullCode,
    normalizedStatus,
    normalizedStatusLabel: getNormalizedStatusLabel(normalizedStatus),
    eventGroup: mapIfoodEventGroup(event.group ?? event.eventGroup),
  }
}
