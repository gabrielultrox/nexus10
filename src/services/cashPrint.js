import { formatCurrencyBRL } from './commerce'

const CASH_RECEIPT_META = {
  brand: 'DELIVERY HORA DEZ',
  phone: '(37) 9953-8008',
  document: '24.858.962/0002-25',
  cityLine: 'Divinopolis, MG',
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatPrintableDate(value) {
  const normalized = new Date(value)

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

function buildReceiptText(entry) {
  const amountLabel = entry.amountLabel || formatCurrencyBRL(entry.amount ?? 0)
  const courierLine = entry.courierName?.trim() ? ` Entregador: ${entry.courierName.trim()}.` : ''
  const observation = entry.note?.trim() ? ` Observacao: ${entry.note.trim()}.` : ''

  return `Recebi de ${CASH_RECEIPT_META.brand} a importancia de ${amountLabel}, referente a ${entry.kindLabel?.toLowerCase()}.${courierLine} Operador responsavel: ${entry.operatorName}.${observation}`
}

function buildPrintHtml(entry) {
  const createdAt = formatPrintableDate(entry.createdAtClient)
  const amountLabel = entry.amountLabel || formatCurrencyBRL(entry.amount ?? 0)
  const note = entry.note?.trim() || 'Sem observacao'
  const operatorName = entry.operatorName || 'Operador local'
  const courierName = entry.courierName?.trim() || ''

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(entry.receiptCode || 'Recibo de caixa')}</title>
    <style>
      :root {
        --paper-width: 80mm;
        --safe-width: 68mm;
        --safe-side: 6mm;
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
        background: #fff;
        color: #000;
        font-family: Arial, sans-serif;
      }

      body {
        width: var(--paper-width);
        padding: 0;
        font-family: "Arial", "Helvetica Neue", sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .receipt {
        display: block;
        width: var(--safe-width);
        max-width: var(--safe-width);
        padding: var(--safe-top) 0 var(--safe-bottom);
        margin: 0 auto;
      }

      .receipt__section + .receipt__section {
        margin-top: 3mm;
      }

      .receipt__header {
        display: grid;
        gap: 1.2mm;
        text-align: center;
      }

      .receipt__brand {
        font-size: 3.6mm;
        font-weight: 700;
        letter-spacing: 0.02em;
        line-height: 1.2;
      }

      .receipt__subline,
      .receipt__legal,
      .receipt__body-copy,
      .receipt__signature-copy {
        font-size: 2.75mm;
        line-height: 1.4;
      }

      .receipt__legal {
        color: #2b2b2b;
      }

      .receipt__title {
        margin: 1mm 0 0;
        font-size: 4.2mm;
        font-weight: 700;
        letter-spacing: 0.12em;
      }

      .receipt__divider {
        width: 100%;
        border-top: 0.24mm solid #111;
      }

      .receipt__summary {
        padding: 2.2mm 0;
        border-top: 0.28mm solid #111;
        border-bottom: 0.28mm solid #111;
        text-align: center;
      }

      .receipt__type {
        font-size: 2.45mm;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #2b2b2b;
      }

      .receipt__value {
        margin-top: 1.1mm;
        font-size: 5mm;
        font-weight: 700;
        line-height: 1;
      }

      .receipt__details {
        display: grid;
        gap: 0;
        margin-top: 3.4mm;
      }

      .receipt__row {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.6mm;
        padding: 1.3mm 0;
        border-bottom: 0.2mm solid #d4d4d4;
      }

      .receipt__row:last-child {
        border-bottom: 0;
      }

      .receipt__label {
        font-size: 2.45mm;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .receipt__data {
        font-size: 2.85mm;
        line-height: 1.4;
        text-align: left;
        word-break: break-word;
        overflow-wrap: anywhere;
      }

      .receipt__body-copy {
        margin: 2.4mm 0 0;
        text-align: left;
        word-break: break-word;
        overflow-wrap: anywhere;
      }

      .receipt__note {
        margin-top: 2.4mm;
        padding-top: 1.8mm;
        border-top: 0.2mm dashed #8c8c8c;
      }

      .receipt__note-title {
        margin-bottom: 1mm;
        font-size: 2.45mm;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #2b2b2b;
      }

      .receipt__sign {
        margin-top: 8mm;
        padding-top: 2.6mm;
        border-top: 0.28mm solid #111;
        text-align: center;
      }

      .receipt__footer {
        display: grid;
        gap: 1.4mm;
        text-align: center;
      }

      @media screen {
        body {
          margin: 0 auto;
          padding: 6mm 3mm 10mm;
          background: #f2f2f2;
        }

        .receipt {
          width: var(--safe-width);
          max-width: var(--safe-width);
          margin: 0 auto;
          padding: 4mm;
          background: #fff;
          box-shadow: 0 0 0 1px #d9d9d9;
        }
      }
    </style>
  </head>
  <body>
    <main class="receipt">
      <section class="receipt__header receipt__section">
        <div class="receipt__brand">${escapeHtml(CASH_RECEIPT_META.brand)}</div>
        <div class="receipt__subline">${escapeHtml(CASH_RECEIPT_META.phone)}</div>
        <div class="receipt__legal">${escapeHtml(CASH_RECEIPT_META.document)}</div>
        <div class="receipt__divider"></div>
        <h1 class="receipt__title">RECIBO</h1>
      </section>

      <section class="receipt__summary receipt__section">
        <div class="receipt__type">${escapeHtml(entry.kindLabel)}</div>
        <div class="receipt__value">${escapeHtml(amountLabel)}</div>
      </section>

      <section class="receipt__section">
        <div class="receipt__details">
          <div class="receipt__row">
            <span class="receipt__label">Documento</span>
            <span class="receipt__data">${escapeHtml(entry.receiptCode)}</span>
          </div>
          <div class="receipt__row">
            <span class="receipt__label">Operador</span>
            <span class="receipt__data">${escapeHtml(operatorName)}</span>
          </div>
          ${
            courierName
              ? `
          <div class="receipt__row">
            <span class="receipt__label">Entregador</span>
            <span class="receipt__data">${escapeHtml(courierName)}</span>
          </div>`
              : ''
          }
          <div class="receipt__row">
            <span class="receipt__label">Data</span>
            <span class="receipt__data">${escapeHtml(createdAt)}</span>
          </div>
        </div>

        <p class="receipt__body-copy">${escapeHtml(buildReceiptText(entry))}</p>

        <div class="receipt__note">
          <div class="receipt__note-title">Observacao</div>
          <div class="receipt__body-copy">${escapeHtml(note)}</div>
        </div>

        <div class="receipt__sign">
          <div class="receipt__signature-copy">________________________________</div>
          <div class="receipt__signature-copy">Assinatura do responsavel</div>
        </div>
      </section>

      <section class="receipt__footer receipt__section">
        <div class="receipt__divider"></div>
        <div class="receipt__brand">${escapeHtml(CASH_RECEIPT_META.brand)}</div>
        <div class="receipt__subline">${escapeHtml(CASH_RECEIPT_META.cityLine)}</div>
        <div class="receipt__subline">${escapeHtml(createdAt)}</div>
      </section>
    </main>
  </body>
</html>`
}

export function printCashReceipt(entry) {
  const printWindow = window.open('', '_blank', 'width=420,height=860')

  if (!printWindow) {
    throw new Error('Nao foi possivel abrir a janela de impressao.')
  }

  printWindow.document.open()
  printWindow.document.write(buildPrintHtml(entry))
  printWindow.document.close()
  printWindow.document.title = entry.receiptCode || 'Recibo de caixa'
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
