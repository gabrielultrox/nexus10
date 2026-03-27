import {
  normalizePaymentMethod,
  normalizeSaleDomainStatus,
} from '../sales/saleValidationService.js'
import { createFinanceRepository } from './financeRepository.js'

const repository = createFinanceRepository()

function buildSaleEntryId(saleId) {
  return `sale-${saleId}`
}

function getFinancialStatus(saleStatus) {
  switch (normalizeSaleDomainStatus(saleStatus)) {
    case 'CANCELLED':
      return 'cancelada'
    case 'REVERSED':
      return 'estornada'
    default:
      return 'ativa'
  }
}

function buildDescription(sale) {
  const customerName = sale.customerSnapshot?.name?.trim()
  return customerName
    ? `Venda ${sale.code ?? sale.id} - ${customerName}`
    : `Venda ${sale.code ?? sale.id}`
}

export async function syncSaleToFinancialEntry({ storeId, tenantId = null, sale }) {
  const entryId = buildSaleEntryId(sale.id)
  const existingEntry = await repository.getFinancialEntryById(storeId, entryId)

  await repository.upsertFinancialEntry(storeId, entryId, {
    type: 'entrada',
    source: 'venda',
    relatedSaleId: sale.id,
    description: buildDescription(sale),
    amount: Number(sale.totals?.total ?? sale.total ?? 0),
    paymentMethod: normalizePaymentMethod(sale.payment?.method ?? sale.paymentMethod, null) ?? '',
    status: getFinancialStatus(sale.status),
    storeId,
    tenantId: tenantId ?? sale.tenantId ?? null,
    createdAt: existingEntry?.createdAt ?? sale.createdAt ?? new Date(),
    updatedAt: new Date(),
  })

  return {
    applied: true,
    entryId,
  }
}
