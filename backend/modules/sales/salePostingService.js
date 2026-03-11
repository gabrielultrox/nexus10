import { recordAuditEvent } from '../audit/auditService.js';
import { syncSaleToFinancialEntry } from '../finance/financeService.js';
import { syncSaleStock } from '../stock/stockService.js';
import { normalizeSaleDomainStatus } from './saleValidationService.js';

function isPosted(status) {
  return normalizeSaleDomainStatus(status, 'POSTED') === 'POSTED';
}

function isReversed(status) {
  const normalized = normalizeSaleDomainStatus(status, 'POSTED');
  return normalized === 'REVERSED' || normalized === 'CANCELLED';
}

function buildAuditDescription(sale, previousStatus) {
  const currentStatus = normalizeSaleDomainStatus(sale.status, 'POSTED');

  if (isPosted(currentStatus) && !isPosted(previousStatus)) {
    return sale.orderId
      ? `Venda ${sale.code ?? sale.id} lancada a partir do pedido ${sale.orderId}.`
      : `Venda ${sale.code ?? sale.id} lancada diretamente.`;
  }

  if (currentStatus === 'REVERSED') {
    return `Venda ${sale.code ?? sale.id} estornada.`;
  }

  if (currentStatus === 'CANCELLED') {
    return `Venda ${sale.code ?? sale.id} cancelada.`;
  }

  return `Venda ${sale.code ?? sale.id} atualizada.`;
}

function buildAuditAction(status, previousStatus) {
  const currentStatus = normalizeSaleDomainStatus(status, 'POSTED');

  if (isPosted(currentStatus) && !isPosted(previousStatus)) {
    return 'sale.posted';
  }

  if (currentStatus === 'REVERSED') {
    return 'sale.reversed';
  }

  if (currentStatus === 'CANCELLED') {
    return 'sale.cancelled';
  }

  return 'sale.updated';
}

export async function postSaleLifecycle({
  storeId,
  tenantId = null,
  sale,
  previousStatus = null,
  actor = null,
}) {
  const stockResult = await syncSaleStock({
    storeId,
    tenantId,
    sale,
    previousStatus,
  });

  const financialResult = await syncSaleToFinancialEntry({
    storeId,
    tenantId,
    sale,
  });

  await recordAuditEvent({
    storeId,
    tenantId,
    actor,
    action: buildAuditAction(sale.status, previousStatus),
    entityType: 'sale',
    entityId: sale.id,
    description: buildAuditDescription(sale, previousStatus),
    metadata: {
      orderId: sale.orderId ?? null,
      source: sale.source ?? null,
      status: normalizeSaleDomainStatus(sale.status, 'POSTED'),
      previousStatus: previousStatus ? normalizeSaleDomainStatus(previousStatus, 'POSTED') : null,
      stockPosted: stockResult.applied,
      financialPosted: financialResult.applied,
      stockMovementCount: stockResult.movementCount ?? 0,
      financialEntryId: financialResult.entryId ?? null,
      reversed: isReversed(sale.status),
    },
  });

  return {
    stockPosted: stockResult.applied,
    financialPosted: financialResult.applied,
  };
}
