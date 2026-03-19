import { formatCurrencyBRL } from './commerce';

const CASH_RECEIPT_META = {
  brand: 'DELIVERY HORA DEZ',
  phone: '(37) 9953-8008',
  document: '24.858.962/0002-25',
  cityLine: 'Divinopolis, MG',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrintableDate(value) {
  const normalized = new Date(value);

  if (Number.isNaN(normalized.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(normalized);
}

function buildReceiptText(entry) {
  const amountLabel = entry.amountLabel || formatCurrencyBRL(entry.amount ?? 0);
  const observation = entry.note?.trim() ? ` Observacao: ${entry.note.trim()}.` : '';

  return `Recebi de ${CASH_RECEIPT_META.brand} a importancia de ${amountLabel}, referente a ${entry.kindLabel?.toLowerCase()}. Operador responsavel: ${entry.operatorName}.${observation}`;
}

function buildPrintHtml(entry) {
  const createdAt = formatPrintableDate(entry.createdAtClient);
  const amountLabel = entry.amountLabel || formatCurrencyBRL(entry.amount ?? 0);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(entry.receiptCode || 'Recibo de caixa')}</title>
    <style>
      @page {
        size: 80mm 297mm;
        margin: 4mm;
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
        width: 72mm;
      }

      .receipt {
        display: grid;
        gap: 8mm;
        width: 100%;
        padding: 4mm 0;
      }

      .receipt__header,
      .receipt__body,
      .receipt__footer {
        display: grid;
        gap: 3mm;
        text-align: center;
      }

      .receipt__brand {
        font-size: 4.2mm;
        font-weight: 700;
        line-height: 1.15;
      }

      .receipt__subline,
      .receipt__meta,
      .receipt__body p,
      .receipt__signature {
        font-size: 3.1mm;
        line-height: 1.4;
      }

      .receipt__title {
        margin: 3mm 0 0;
        font-size: 5.2mm;
        font-weight: 700;
      }

      .receipt__divider {
        width: 100%;
        border-top: 0.3mm solid #111;
      }

      .receipt__body {
        gap: 4mm;
      }

      .receipt__value {
        font-size: 4.4mm;
        font-weight: 700;
      }

      .receipt__signature {
        margin-top: 10mm;
      }

      @media screen {
        body {
          margin: 0 auto;
          padding: 6mm 0;
        }
      }
    </style>
  </head>
  <body>
    <main class="receipt">
      <section class="receipt__header">
        <div class="receipt__brand">${escapeHtml(CASH_RECEIPT_META.brand)}</div>
        <div class="receipt__subline">${escapeHtml(CASH_RECEIPT_META.phone)}</div>
        <div class="receipt__divider"></div>
        <h1 class="receipt__title">RECIBO</h1>
      </section>

      <section class="receipt__body">
        <p>${escapeHtml(buildReceiptText(entry))}</p>
        <div class="receipt__value">${escapeHtml(amountLabel)}</div>
        <div class="receipt__meta">
          Documento: ${escapeHtml(entry.receiptCode)}<br />
          Tipo: ${escapeHtml(entry.kindLabel)}<br />
          Data/Hora: ${escapeHtml(createdAt)}
        </div>
        <p class="receipt__signature">Por ser verdade firmo o presente.<br />${escapeHtml(CASH_RECEIPT_META.cityLine)}, ${escapeHtml(createdAt)}</p>
      </section>

      <section class="receipt__footer">
        <div class="receipt__divider"></div>
        <div class="receipt__brand">${escapeHtml(CASH_RECEIPT_META.brand)}</div>
        <div class="receipt__subline">${escapeHtml(CASH_RECEIPT_META.document)}</div>
        <div class="receipt__subline">${escapeHtml(createdAt)}</div>
      </section>
    </main>
  </body>
</html>`;
}

export function printCashReceipt(entry) {
  const printWindow = window.open('', '_blank', 'width=420,height=860');

  if (!printWindow) {
    throw new Error('Nao foi possivel abrir a janela de impressao.');
  }

  printWindow.document.open();
  printWindow.document.write(buildPrintHtml(entry));
  printWindow.document.close();
  printWindow.document.title = entry.receiptCode || 'Recibo de caixa';
  printWindow.focus();

  const triggerPrint = () => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch {
      // Ignore print invocation errors to avoid blocking the shell.
    }
  };

  printWindow.onload = () => {
    triggerPrint();
  };

  printWindow.onafterprint = () => {
    printWindow.close();
  };

  printWindow.setTimeout(triggerPrint, 350);
}
