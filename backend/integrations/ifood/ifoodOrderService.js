import {
  buildExternalOrderDocumentId,
  buildExternalOrderTimelineEntry,
  buildExternalOrderTrackingEntry,
} from '../../../src/services/integrations/externalOrderModel.js'
import { resolveIfoodEventDescriptor, shouldCreateTrackingEntry } from './ifoodStatusMapper.js'

function parsePhoneNumber(phone = {}) {
  return phone?.number ?? phone ?? ''
}

function parseOrderCustomer(rawOrder = {}) {
  const customer = rawOrder.customer ?? {}
  const deliveryAddress =
    rawOrder.delivery?.deliveryAddress ?? rawOrder.order?.deliveryAddress ?? {}

  return {
    name: customer.name ?? '',
    phone: parsePhoneNumber(customer.phone),
    documentNumber: customer.documentNumber ?? '',
    address: {
      streetName: deliveryAddress.streetName ?? '',
      streetNumber: deliveryAddress.streetNumber ?? '',
      neighborhood: deliveryAddress.neighborhood ?? '',
      city: deliveryAddress.city ?? '',
      postalCode: deliveryAddress.postalCode ?? '',
      coordinates: deliveryAddress.coordinates ?? null,
    },
  }
}

function parseOrderItems(rawOrder = {}) {
  return Array.isArray(rawOrder.items)
    ? rawOrder.items.map((item) => ({
        id: item.id ?? item.uniqueId ?? item.index ?? item.name,
        name: item.name ?? 'Item',
        quantity: Number(item.quantity ?? 1),
        unitPrice: Number(item.unitPrice ?? item.price ?? 0),
        totalPrice: Number(
          item.totalPrice ??
            item.total ??
            (item.quantity ?? 1) * (item.unitPrice ?? item.price ?? 0),
        ),
        options: Array.isArray(item.options) ? item.options : [],
        notes: item.observations ?? '',
      }))
    : []
}

function parseBenefits(rawBenefits = [], targetType) {
  return rawBenefits
    .filter((benefit) => String(benefit?.target ?? '').toUpperCase() === targetType)
    .reduce((total, benefit) => total + Number(benefit?.value ?? 0), 0)
}

export function createIfoodOrderService({ repositories } = {}) {
  if (!repositories?.upsertOrder || !repositories?.upsertEvent || !repositories?.appendLog) {
    throw new Error(
      'Repositórios de persistência são obrigatórios para o serviço de pedidos do iFood.',
    )
  }

  return {
    async upsertOrderFromDetails({
      storeId,
      tenantId,
      merchant,
      rawOrder,
      event = null,
      syncContext = {},
    }) {
      const descriptor = resolveIfoodEventDescriptor({
        code: event?.code ?? rawOrder.orderTiming?.orderStatus,
        fullCode: event?.fullCode ?? rawOrder.orderTiming?.orderStatus,
        group: event?.eventGroup ?? event?.group,
      })
      const subtotal = Number(rawOrder.total?.subTotal ?? rawOrder.total?.subtotal ?? 0)
      const discount = parseBenefits(rawOrder.benefits, 'ITEM')
      const shipping = Number(rawOrder.total?.deliveryFee ?? rawOrder.total?.shipping ?? 0)
      const total = Number(rawOrder.total?.orderAmount ?? rawOrder.total?.total ?? 0)
      const documentId = buildExternalOrderDocumentId('ifood', merchant.merchantId, rawOrder.id)
      const timelineEntry = event
        ? buildExternalOrderTimelineEntry({
            eventId: event.id,
            code: event.code,
            fullCode: event.fullCode,
            label: descriptor.normalizedStatusLabel,
            description: `Evento ${event.code ?? event.fullCode ?? 'ifood'} recebido pelo integrador.`,
            happenedAt: event.createdAt,
            metadata: {
              salesChannel: event.salesChannel ?? null,
              category: event.category ?? null,
            },
          })
        : null
      const trackingEntry = shouldCreateTrackingEntry(event ?? {})
        ? buildExternalOrderTrackingEntry({
            trackingId: `ifood:${merchant.merchantId}:${rawOrder.id}:${event?.id ?? descriptor.normalizedStatus}`,
            externalOrderId: rawOrder.id,
            merchantId: merchant.merchantId,
            source: 'ifood',
            status: descriptor.normalizedStatus,
            label: descriptor.normalizedStatusLabel,
            description: `Tracking atualizado via evento ${event?.code ?? event?.fullCode ?? descriptor.normalizedStatus}.`,
            happenedAt: event?.createdAt ?? rawOrder.updatedAt ?? rawOrder.createdAt,
            eventId: event?.id ?? null,
          })
        : null

      const normalizedOrder = {
        id: documentId,
        source: 'ifood',
        externalOrderId: rawOrder.id,
        merchantId: merchant.merchantId,
        displayId: rawOrder.displayId ?? rawOrder.shortReference ?? '',
        customer: parseOrderCustomer(rawOrder),
        items: parseOrderItems(rawOrder),
        subtotal,
        discount,
        shipping,
        total,
        paymentMethod:
          rawOrder.payments?.methods?.[0]?.method ?? rawOrder.payments?.[0]?.method ?? '',
        externalStatus: event?.code ?? event?.fullCode ?? rawOrder.orderTiming?.orderStatus ?? '',
        normalizedStatus: descriptor.normalizedStatus,
        salesChannel: event?.salesChannel ?? rawOrder.salesChannel ?? 'IFOOD',
        category: event?.category ?? rawOrder.category ?? '',
        tracking: trackingEntry ? [trackingEntry] : [],
        timeline: timelineEntry ? [timelineEntry] : [],
        sync: {
          lastEventId: event?.id ?? syncContext.lastEventId ?? null,
          lastSyncAt: syncContext.syncedAt ?? new Date().toISOString(),
          lastSyncError: null,
          duplicateEventCount: syncContext.duplicateEventCount ?? 0,
        },
        createdAt: rawOrder.createdAt ?? new Date().toISOString(),
        updatedAt: rawOrder.updatedAt ?? event?.createdAt ?? new Date().toISOString(),
        raw: rawOrder,
      }

      await repositories.upsertOrder({
        storeId,
        tenantId,
        order: normalizedOrder,
      })

      if (trackingEntry) {
        await repositories.upsertTracking({
          storeId,
          tenantId,
          trackingEntry,
        })
      }

      await repositories.appendLog({
        storeId,
        tenantId,
        log: {
          source: 'ifood',
          merchantId: merchant.merchantId,
          externalOrderId: rawOrder.id,
          scope: 'order.upsert',
          level: 'info',
          message: `Pedido ${rawOrder.displayId ?? rawOrder.id} normalizado com status ${descriptor.normalizedStatus}.`,
          payload: {
            eventId: event?.id ?? null,
            normalizedStatus: descriptor.normalizedStatus,
          },
        },
      })

      return normalizedOrder
    },
  }
}
