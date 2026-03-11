import { normalizeSaleDomainStatus } from '../sales/saleValidationService.js';
import { applyStockMovement } from './stockMovementService.js';

function isPosted(status) {
  return normalizeSaleDomainStatus(status) === 'POSTED';
}

function isReversal(status) {
  const normalized = normalizeSaleDomainStatus(status);
  return normalized === 'CANCELLED' || normalized === 'REVERSED';
}

export async function syncSaleStock({ storeId, tenantId = null, sale, previousStatus = null }) {
  const items = Array.isArray(sale?.items) ? sale.items.filter((item) => item?.productId) : [];

  if (items.length === 0) {
    return {
      applied: false,
      movementCount: 0,
    };
  }

  if (isPosted(sale.status) && !isPosted(previousStatus)) {
    for (const item of items) {
      await applyStockMovement({
        storeId,
        tenantId,
        productId: item.productId,
        movementType: 'sale',
        quantity: Number(item.quantity ?? 0),
        reason: `Baixa automatica da venda ${sale.id}`,
        source: 'sale',
        relatedSaleId: sale.id,
        movementId: `sale-${sale.id}-${item.productId}-out`,
        productSnapshot: {
          name: item.productSnapshot?.name ?? item.name,
          category: item.productSnapshot?.category ?? '',
          sku: item.productSnapshot?.sku ?? '',
        },
      });
    }

    return {
      applied: true,
      movementCount: items.length,
    };
  }

  if (isReversal(sale.status) && isPosted(previousStatus)) {
    for (const item of items) {
      await applyStockMovement({
        storeId,
        tenantId,
        productId: item.productId,
        movementType: 'sale_reversal',
        quantity: Number(item.quantity ?? 0),
        reason: `Reversao automatica da venda ${sale.id}`,
        source: 'sale',
        relatedSaleId: sale.id,
        movementId: `sale-${sale.id}-${item.productId}-reversal`,
        productSnapshot: {
          name: item.productSnapshot?.name ?? item.name,
          category: item.productSnapshot?.category ?? '',
          sku: item.productSnapshot?.sku ?? '',
        },
      });
    }

    return {
      applied: true,
      movementCount: items.length,
    };
  }

  return {
    applied: false,
    movementCount: 0,
  };
}
