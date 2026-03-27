import {
  formatCurrencyBRL,
  getChannelLabel,
  getOrderDomainStatusLabel,
  getPaymentMethodLabel,
} from './commerce'
import { getSaleStatusMeta } from './sales'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatPrintableDate(value) {
  if (!value) {
    return '--'
  }

  const normalized = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)

  if (Number.isNaN(normalized.getTime())) {
    return '--'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(normalized)
}

function buildDocumentTitle(type, code) {
  const safeCode = escapeHtml(code || '--')
  return type === 'order' ? `Pedido ${safeCode}` : `Venda ${safeCode}`
}

function buildOrderPrintModel(order) {
  return {
    title: buildDocumentTitle('order', order.number || order.code),
    brand: 'Hora Dez Conveniencia',
    eyebrow: 'Comprovante operacional',
    typeLabel: 'Pedido',
    code: order.number || order.code || '--',
    secondaryCode: order.code || '--',
    status: getOrderDomainStatusLabel(order.domainStatus),
    source:
      order.origin || order.sourceLabel || getChannelLabel(order.sourceChannel ?? order.source),
    customer: order.customerName || 'Cliente avulso',
    customerPhone: order.customerSnapshot?.phone || 'Sem telefone',
    payment: order.paymentMethodLabel || getPaymentMethodLabel(order.paymentMethod),
    createdAt: formatPrintableDate(order.createdAt),
    updatedAt: formatPrintableDate(order.updatedAt),
    addressLine: order.address?.addressLine || 'Endereco nao informado',
    neighborhood: order.address?.neighborhood || 'Bairro nao informado',
    reference: order.address?.reference || 'Sem referencia',
    complement: order.address?.complement || 'Sem complemento',
    notes: order.notes || 'Nenhuma observacao registrada.',
    linkLabel: order.saleId ? `Venda vinculada: ${order.saleId}` : 'Ainda sem venda vinculada.',
    items: (order.items || []).map((item) => ({
      name: item.productSnapshot?.name ?? item.name ?? 'Item',
      quantity: item.quantity ?? 0,
      unitPrice: formatCurrencyBRL(item.unitPrice ?? 0),
      totalPrice: formatCurrencyBRL(item.totalPrice ?? 0),
    })),
    totals: [
      { label: 'Subtotal', value: formatCurrencyBRL(order.totals?.subtotal ?? 0) },
      { label: 'Frete', value: formatCurrencyBRL(order.totals?.freight ?? 0) },
      { label: 'Adicional', value: formatCurrencyBRL(order.totals?.extraAmount ?? 0) },
      { label: 'Desconto', value: formatCurrencyBRL(order.totals?.discountValue ?? 0) },
      { label: 'Total', value: formatCurrencyBRL(order.totals?.total ?? 0), isTotal: true },
    ],
  }
}

function buildSalePrintModel(sale) {
  return {
    title: buildDocumentTitle('sale', sale.number || sale.code),
    brand: 'Hora Dez Conveniencia',
    eyebrow: 'Comprovante operacional',
    typeLabel: 'Venda',
    code: sale.number || sale.code || '--',
    secondaryCode: sale.code || '--',
    status: getSaleStatusMeta(sale.domainStatus).label,
    source: sale.channelLabel || 'Canal nao informado',
    customer: sale.customerSnapshot?.name || 'Cliente avulso',
    customerPhone: sale.customerSnapshot?.phone || 'Sem telefone',
    payment: sale.paymentMethodLabel || getPaymentMethodLabel(sale.paymentMethod),
    createdAt: formatPrintableDate(sale.createdAtDate ?? sale.createdAt),
    updatedAt: formatPrintableDate(sale.launchedAtDate ?? sale.launchedAt),
    addressLine: sale.address?.addressLine || 'Endereco nao informado',
    neighborhood: sale.address?.neighborhood || 'Bairro nao informado',
    reference: sale.address?.reference || 'Sem referencia',
    complement: sale.address?.complement || 'Sem complemento',
    notes: sale.notes || 'Nenhuma observacao registrada.',
    linkLabel: sale.orderId ? `Pedido vinculado: ${sale.orderId}` : 'Venda criada diretamente.',
    items: (sale.items || []).map((item) => ({
      name: item.name || item.productSnapshot?.name || 'Item',
      quantity: item.quantity ?? 0,
      unitPrice: formatCurrencyBRL(item.unitPrice ?? 0),
      totalPrice: formatCurrencyBRL(item.totalPrice ?? item.total ?? 0),
    })),
    totals: [
      { label: 'Subtotal', value: formatCurrencyBRL(sale.totals?.subtotal ?? 0) },
      { label: 'Frete', value: formatCurrencyBRL(sale.totals?.freight ?? 0) },
      { label: 'Adicional', value: formatCurrencyBRL(sale.totals?.extraAmount ?? 0) },
      { label: 'Desconto', value: formatCurrencyBRL(sale.totals?.discountValue ?? 0) },
      { label: 'Total', value: formatCurrencyBRL(sale.totals?.total ?? 0), isTotal: true },
    ],
  }
}

function renderItems(items) {
  if (!items.length) {
    return `
      <div class="print-ticket__empty">Nenhum item registrado.</div>
    `
  }

  return items
    .map(
      (item) => `
        <div class="print-ticket__item">
          <div class="print-ticket__item-main">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.quantity)} x ${escapeHtml(item.unitPrice)}</span>
          </div>
          <strong class="print-ticket__item-total">${escapeHtml(item.totalPrice)}</strong>
        </div>
      `,
    )
    .join('')
}

function renderTotals(totals) {
  return totals
    .map(
      (item) => `
        <div class="print-ticket__total-row${item.isTotal ? ' print-ticket__total-row--grand' : ''}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `,
    )
    .join('')
}

function buildPrintHtml(model) {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(model.title)}</title>
    <style>
      :root {
        --paper-width: 80mm;
        --safe-width: 68mm;
        --safe-top: 2mm;
        --safe-bottom: 4mm;
      }

      @page {
        size: 80mm 297mm;
        margin: 0;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #111827;
        font-family: "DM Sans", "Segoe UI", sans-serif;
      }

      body {
        width: var(--paper-width);
        font-family: Arial, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .print-ticket {
        display: block;
        width: var(--safe-width);
        max-width: var(--safe-width);
        margin: 0 auto;
        padding: var(--safe-top) 0 var(--safe-bottom);
      }

      .print-ticket__section + .print-ticket__section {
        margin-top: 3mm;
      }

      .print-ticket__header,
      .print-ticket__section,
      .print-ticket__totals,
      .print-ticket__footer {
        display: grid;
        gap: 1.4mm;
      }

      .print-ticket__eyebrow,
      .print-ticket__brand,
      .print-ticket__label,
      .print-ticket__notes-label {
        display: block;
        color: #3f3f46;
        font-family: Arial, sans-serif;
        font-size: 2.45mm;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .print-ticket__brand {
        color: #111827;
        font-size: 3.6mm;
        letter-spacing: 0.02em;
        text-align: center;
      }

      .print-ticket__title {
        margin: 0.6mm 0 0;
        font-family: Arial, sans-serif;
        font-size: 4.3mm;
        line-height: 1.15;
        text-align: center;
      }

      .print-ticket__subtitle {
        margin: 0;
        color: #52525b;
        font-size: 2.8mm;
        text-align: center;
      }

      .print-ticket__meta {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.6mm;
        margin-top: 2.4mm;
      }

      .print-ticket__meta div,
      .print-ticket__identity-line,
      .print-ticket__address-line {
        display: grid;
        gap: 0.4mm;
        padding: 1.3mm 0;
        border-bottom: 0.2mm solid #d4d4d4;
      }

      .print-ticket__meta div:last-child,
      .print-ticket__identity-line:last-child,
      .print-ticket__address-line:last-child {
        border-bottom: 0;
      }

      .print-ticket__meta strong,
      .print-ticket__identity strong,
      .print-ticket__address strong,
      .print-ticket__item strong,
      .print-ticket__total-row strong {
        color: #111827;
      }

      .print-ticket__identity,
      .print-ticket__address,
      .print-ticket__notes {
        display: grid;
        gap: 0;
      }

      .print-ticket__identity p,
      .print-ticket__address p,
      .print-ticket__notes p,
      .print-ticket__item span,
      .print-ticket__empty,
      .print-ticket__footer p {
        margin: 0;
        color: #52525b;
        font-size: 2.8mm;
        line-height: 1.45;
        word-break: break-word;
        overflow-wrap: anywhere;
      }

      .print-ticket__items {
        display: grid;
        gap: 0;
        margin-top: 1.2mm;
      }

      .print-ticket__items-head {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 2mm;
        padding-bottom: 1.4mm;
        border-bottom: 0.24mm solid #111;
        color: #3f3f46;
        font-family: Arial, sans-serif;
        font-size: 2.35mm;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .print-ticket__item {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 2mm;
        align-items: start;
        padding: 1.6mm 0;
        border-bottom: 0.2mm solid #d4d4d4;
      }

      .print-ticket__item:last-child {
        border-bottom: 0;
      }

      .print-ticket__item-main {
        display: grid;
        gap: 0.6mm;
        min-width: 0;
      }

      .print-ticket__item-total {
        font-size: 2.9mm;
        white-space: nowrap;
      }

      .print-ticket__totals {
        display: grid;
        gap: 0;
        margin-top: 2mm;
        padding-top: 1.4mm;
        border-top: 0.24mm solid #111;
      }

      .print-ticket__total-row {
        display: flex;
        justify-content: space-between;
        gap: 2mm;
        align-items: center;
        padding: 1.3mm 0;
        border-bottom: 0.2mm solid #d4d4d4;
        font-size: 2.8mm;
        color: #52525b;
      }

      .print-ticket__total-row:last-child {
        border-bottom: 0;
      }

      .print-ticket__total-row--grand {
        padding-top: 1.8mm;
        font-size: 3.1mm;
      }

      .print-ticket__total-row--grand strong {
        font-size: 4.1mm;
      }

      .print-ticket__footer {
        display: grid;
        gap: 1.2mm;
        margin-top: 2.6mm;
        padding-top: 1.8mm;
        border-top: 0.24mm solid #111;
      }

      .print-ticket__footer-note {
        padding-top: 1.2mm;
        border-top: 0.2mm dashed #8c8c8c;
      }

      @media screen {
        body {
          margin: 0 auto;
          padding: 4mm 0 10mm;
          background: #f2f2f2;
        }

        .print-ticket {
          background: #fff;
          box-shadow: 0 0 0 1px #d9d9d9;
          padding: 4mm;
        }
      }
    </style>
  </head>
  <body>
    <main class="print-ticket">
      <section class="print-ticket__header">
        <span class="print-ticket__brand">${escapeHtml(model.brand)}</span>
        <span class="print-ticket__eyebrow">${escapeHtml(model.eyebrow)}</span>
        <h1 class="print-ticket__title">${escapeHtml(model.typeLabel)} ${escapeHtml(model.code)}</h1>
        <p class="print-ticket__subtitle">${escapeHtml(model.linkLabel)}</p>
        <div class="print-ticket__meta">
          <div>
            <span>Status</span>
            <strong>${escapeHtml(model.status)}</strong>
          </div>
          <div>
            <span>Canal</span>
            <strong>${escapeHtml(model.source)}</strong>
          </div>
          <div>
            <span>Pagamento</span>
            <strong>${escapeHtml(model.payment)}</strong>
          </div>
          <div>
            <span>Criado em</span>
            <strong>${escapeHtml(model.createdAt)}</strong>
          </div>
        </div>
      </section>

      <section class="print-ticket__section print-ticket__identity">
        <span class="print-ticket__label">Cliente</span>
        <div class="print-ticket__identity-line">
          <strong>${escapeHtml(model.customer)}</strong>
          <p>${escapeHtml(model.customerPhone)}</p>
        </div>
        <div class="print-ticket__identity-line">
          <p>Codigo interno: ${escapeHtml(model.secondaryCode)}</p>
        </div>
      </section>

      <section class="print-ticket__section print-ticket__address">
        <span class="print-ticket__label">Entrega</span>
        <div class="print-ticket__address-line">
          <strong>${escapeHtml(model.addressLine)}</strong>
          <p>${escapeHtml(model.neighborhood)}</p>
        </div>
        <div class="print-ticket__address-line">
          <p>${escapeHtml(model.reference)}</p>
          <p>${escapeHtml(model.complement)}</p>
        </div>
      </section>

      <section class="print-ticket__section">
        <span class="print-ticket__label">Itens</span>
        <div class="print-ticket__items">
          <div class="print-ticket__items-head">
            <span>Descricao</span>
            <span>Total</span>
          </div>
          ${renderItems(model.items)}
        </div>
      </section>

      <section class="print-ticket__totals">
        ${renderTotals(model.totals)}
      </section>

      <section class="print-ticket__footer">
        <div class="print-ticket__notes">
          <span class="print-ticket__notes-label">Observacoes</span>
          <p>${escapeHtml(model.notes)}</p>
        </div>
        <p class="print-ticket__footer-note">Atualizado em ${escapeHtml(model.updatedAt)}</p>
        <p>Impressao operacional para conferencia rapida.</p>
      </section>
    </main>
  </body>
</html>`
}

function openPrintWindow(html, title) {
  const printWindow = window.open('', '_blank', 'width=460,height=880')

  if (!printWindow) {
    throw new Error('Nao foi possivel abrir a janela de impressao.')
  }

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.document.title = title
  printWindow.focus()

  const triggerPrint = () => {
    try {
      printWindow.focus()
      printWindow.print()
    } catch {
      // Ignore print invocation errors to avoid blocking the shell.
    }
  }

  printWindow.onload = () => {
    triggerPrint()
  }

  printWindow.onafterprint = () => {
    printWindow.close()
  }

  printWindow.setTimeout(triggerPrint, 350)
}

export function printOrderTicket(order) {
  const model = buildOrderPrintModel(order)
  openPrintWindow(buildPrintHtml(model), model.title)
}

export function printSaleTicket(sale) {
  const model = buildSalePrintModel(sale)
  openPrintWindow(buildPrintHtml(model), model.title)
}
