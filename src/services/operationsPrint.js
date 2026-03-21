function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSummaryItems(items = []) {
  return items
    .filter((item) => item?.label && item?.value != null)
    .map((item) => `
      <div class="ops-print__summary-item">
        <span class="ops-print__summary-label">${escapeHtml(item.label)}</span>
        <strong class="ops-print__summary-value">${escapeHtml(item.value)}</strong>
      </div>
    `)
    .join('');
}

function renderRecordItems(records = []) {
  if (!records.length) {
    return `
      <div class="ops-print__empty">Nenhum registro encontrado para impressao.</div>
    `;
  }

  return records
    .map((record) => `
      <article class="ops-print__item">
        <div class="ops-print__item-top">
          <strong class="ops-print__item-title">${escapeHtml(record.title || 'Registro')}</strong>
          ${record.badge ? `<span class="ops-print__item-badge">${escapeHtml(record.badge)}</span>` : ''}
        </div>
        ${record.subtitle ? `<div class="ops-print__item-subtitle">${escapeHtml(record.subtitle)}</div>` : ''}
        <div class="ops-print__item-fields">
          ${(record.fields || [])
            .filter((field) => field?.label && field?.value != null)
            .map((field) => `
              <div class="ops-print__field">
                <span class="ops-print__field-label">${escapeHtml(field.label)}</span>
                <strong class="ops-print__field-value">${escapeHtml(field.value)}</strong>
              </div>
            `)
            .join('')}
        </div>
      </article>
    `)
    .join('');
}

function buildPrintHtml(report) {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(report.title || 'Relatorio operacional')}</title>
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
        background: #fff;
        color: #000;
        font-family: Arial, sans-serif;
      }

      body {
        width: var(--paper-width);
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .ops-print {
        display: block;
        width: var(--safe-width);
        max-width: var(--safe-width);
        margin: 0 auto;
        padding: var(--safe-top) 0 var(--safe-bottom);
      }

      .ops-print__section + .ops-print__section {
        margin-top: 2.6mm;
      }

      .ops-print__header,
      .ops-print__footer {
        display: grid;
        gap: 1.2mm;
        text-align: center;
      }

      .ops-print__eyebrow,
      .ops-print__summary-label,
      .ops-print__field-label {
        font-size: 2.4mm;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #2f2f2f;
      }

      .ops-print__title {
        font-size: 4.1mm;
        font-weight: 700;
        line-height: 1.1;
      }

      .ops-print__subtitle,
      .ops-print__meta,
      .ops-print__item-subtitle,
      .ops-print__empty {
        font-size: 2.7mm;
        line-height: 1.35;
        color: #303030;
      }

      .ops-print__divider {
        width: 100%;
        border-top: 0.24mm solid #111;
      }

      .ops-print__summary {
        display: grid;
        gap: 1.4mm;
        padding: 2mm 0;
        border-top: 0.24mm solid #111;
        border-bottom: 0.24mm solid #111;
      }

      .ops-print__summary-item {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 2mm;
      }

      .ops-print__summary-value,
      .ops-print__field-value,
      .ops-print__item-title {
        font-size: 2.9mm;
        line-height: 1.35;
      }

      .ops-print__list {
        display: grid;
        gap: 1.8mm;
      }

      .ops-print__item {
        display: grid;
        gap: 1mm;
        padding: 0 0 1.8mm;
        border-bottom: 0.2mm dashed #9d9d9d;
      }

      .ops-print__item-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 2mm;
      }

      .ops-print__item-badge {
        font-size: 2.2mm;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .ops-print__item-fields {
        display: grid;
        gap: 0.8mm;
      }

      .ops-print__field {
        display: grid;
        gap: 0.35mm;
      }

      .ops-print__empty {
        min-height: 20mm;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
      }

      @media screen {
        body {
          margin: 0 auto;
          padding: 6mm 3mm 10mm;
          background: #f2f2f2;
        }

        .ops-print {
          background: #fff;
          padding: 4mm;
          box-shadow: 0 0 0 1px #d9d9d9;
        }
      }
    </style>
  </head>
  <body>
    <main class="ops-print">
      <section class="ops-print__header ops-print__section">
        <span class="ops-print__eyebrow">NEXUS</span>
        <strong class="ops-print__title">${escapeHtml(report.title || 'Relatorio operacional')}</strong>
        ${report.subtitle ? `<span class="ops-print__subtitle">${escapeHtml(report.subtitle)}</span>` : ''}
        ${report.meta ? `<span class="ops-print__meta">${escapeHtml(report.meta)}</span>` : ''}
        <div class="ops-print__divider"></div>
      </section>

      <section class="ops-print__summary ops-print__section">
        ${renderSummaryItems(report.summary)}
      </section>

      <section class="ops-print__list ops-print__section">
        ${renderRecordItems(report.records)}
      </section>

      <section class="ops-print__footer ops-print__section">
        <div class="ops-print__divider"></div>
        <span class="ops-print__meta">${escapeHtml(report.footer || 'Gerado automaticamente pelo ERP operacional')}</span>
      </section>
    </main>
  </body>
</html>`;
}

export function printOperationalReport(report) {
  const printWindow = window.open('', '_blank', 'width=420,height=860');

  if (!printWindow) {
    throw new Error('Nao foi possivel abrir a janela de impressao.');
  }

  printWindow.document.open();
  printWindow.document.write(buildPrintHtml(report));
  printWindow.document.close();
  printWindow.document.title = report.title || 'Relatorio operacional';
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
