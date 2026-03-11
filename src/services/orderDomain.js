import {
  buildRecordCode,
  getChannelLabel,
  getPaymentMethodLabel,
  normalizeChannel,
  normalizeOrderDomainStatus,
  normalizeOrderSaleStatus,
  normalizePaymentMethod,
} from './commerce';

function parseMoney(value, fieldLabel) {
  const normalized = String(value ?? 0).replace(/\s+/g, '').replace(',', '.');
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} invalido.`);
  }

  return Number(parsed.toFixed(2));
}

function normalizeProductSnapshot(item, index) {
  const productName = item?.productSnapshot?.name?.trim() || item?.name?.trim();

  if (!productName) {
    throw new Error(`Item ${index + 1} sem nome.`);
  }

  return {
    id: item?.productSnapshot?.id ?? item?.productId ?? null,
    name: productName,
    category: item?.productSnapshot?.category ?? '',
    sku: item?.productSnapshot?.sku ?? '',
  };
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('O pedido precisa ter ao menos um item.');
  }

  return items.map((item, index) => {
    const quantity = Number(item?.quantity ?? 0);
    const unitPrice = Number(item?.unitPrice ?? 0);
    const productSnapshot = normalizeProductSnapshot(item, index);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Quantidade invalida no item ${index + 1}.`);
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Preco invalido no item ${index + 1}.`);
    }

    return {
      productId: item?.productId ?? productSnapshot.id,
      productSnapshot,
      quantity,
      unitPrice: Number(unitPrice.toFixed(2)),
      totalPrice: Number((quantity * unitPrice).toFixed(2)),
    };
  });
}

function normalizeTotals(items, values) {
  const subtotalFromItems = Number(
    items.reduce((total, item) => total + Number(item.totalPrice ?? 0), 0).toFixed(2),
  );
  const totals = values?.totals ?? {};
  const freight = parseMoney(totals.freight ?? values.freight ?? values.shipping ?? 0, 'Frete');
  const extraAmount = parseMoney(totals.extraAmount ?? values.extraAmount ?? 0, 'Adicional');
  const discountPercent = parseMoney(totals.discountPercent ?? values.discountPercent ?? 0, 'Desconto percentual');
  const discountValue = parseMoney(totals.discountValue ?? values.discountValue ?? values.discount ?? 0, 'Desconto');
  const informedSubtotal = totals.subtotal != null ? parseMoney(totals.subtotal, 'Subtotal') : subtotalFromItems;

  if (Math.abs(informedSubtotal - subtotalFromItems) > 0.01) {
    throw new Error('Subtotal inconsistente com os itens informados.');
  }

  const expectedTotal = Number((informedSubtotal + extraAmount + freight - discountValue).toFixed(2));
  const informedTotal = totals.total != null
    ? parseMoney(totals.total, 'Total')
    : parseMoney(values.total ?? expectedTotal, 'Total');

  if (Math.abs(informedTotal - expectedTotal) > 0.01) {
    throw new Error('Total inconsistente com subtotal, frete, adicional e desconto.');
  }

  return {
    subtotal: informedSubtotal,
    freight,
    extraAmount,
    discountPercent,
    discountValue,
    total: informedTotal,
  };
}

function normalizeCustomerSnapshot(values) {
  const source = values.customerSnapshot ?? {};
  const name = source.name?.trim() || values.customerName?.trim() || 'Cliente avulso';

  return {
    id: source.id ?? values.customerId ?? null,
    name,
    phone: source.phone ?? values.customerPhone ?? '',
    neighborhood: source.neighborhood ?? values.neighborhood ?? '',
  };
}

function normalizeAddress(values) {
  const source = values.address ?? {};

  return {
    neighborhood: source.neighborhood ?? values.neighborhood ?? '',
    addressLine: source.addressLine ?? values.addressLine ?? '',
    reference: source.reference ?? values.reference ?? '',
    complement: source.complement ?? values.complement ?? '',
  };
}

export function validateOrderInput(values) {
  const source = normalizeChannel(values.source ?? values.channel);

  if (!source) {
    throw new Error('Informe o canal do pedido.');
  }

  const items = normalizeItems(values.items);
  const totals = normalizeTotals(items, values);
  const paymentMethod = normalizePaymentMethod(
    values.paymentPreview?.method ?? values.paymentMethod ?? values.payment?.method,
  );

  return {
    code: values.code?.trim() || buildRecordCode('PED'),
    source,
    sourceLabel: getChannelLabel(source),
    customerId: values.customerId?.trim() || values.customerSnapshot?.id || null,
    customerSnapshot: normalizeCustomerSnapshot(values),
    items,
    totals,
    paymentPreview: paymentMethod
      ? {
        method: paymentMethod,
        label: getPaymentMethodLabel(paymentMethod),
        amount: totals.total,
      }
      : null,
    address: normalizeAddress(values),
    notes: values.notes?.trim() ?? '',
    status: normalizeOrderDomainStatus(values.status, 'OPEN'),
    saleStatus: normalizeOrderSaleStatus(values.saleStatus, 'NOT_LAUNCHED'),
    saleId: values.saleId?.trim() || null,
  };
}
