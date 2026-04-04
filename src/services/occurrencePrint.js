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

function renderField(label, value) {
  if (value == null || String(value).trim() === '') {
    return ''
  }

  return `
    <div class="occurrence-print__field">
      <span class="occurrence-print__field-label">${escapeHtml(label)}</span>
      <strong class="occurrence-print__field-value">${escapeHtml(value)}</strong>
    </div>
  `
}

function buildPrintHtml(entry) {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(entry.documentTitle || 'Ocorrencia operacional')}</title>
    <style>
      :root {
        --paper-width: 80mm;
        --safe-width: 70mm;
        --safe-top: 1.5mm;
        --safe-bottom: 3mm;
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

      .occurrence-print {
        display: block;
        width: var(--safe-width);
        max-width: var(--safe-width);
        margin: 0 auto;
        padding: var(--safe-top) 0 var(--safe-bottom);
      }

      .occurrence-print__section + .occurrence-print__section {
        margin-top: 1.4mm;
      }

      .occurrence-print__header,
      .occurrence-print__footer {
        display: grid;
        gap: 0.45mm;
        text-align: center;
      }

      .occurrence-print__eyebrow,
      .occurrence-print__field-label,
      .occurrence-print__summary-label,
      .occurrence-print__body-title {
        font-size: 2.2mm;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #2f2f2f;
      }

      .occurrence-print__title {
        font-size: 3.3mm;
        font-weight: 700;
        line-height: 1.15;
      }

      .occurrence-print__subtitle,
      .occurrence-print__meta {
        font-size: 2.45mm;
        line-height: 1.25;
        color: #303030;
      }

      .occurrence-print__divider {
        width: 100%;
        border-top: 0.24mm solid #111;
      }

      .occurrence-print__summary {
        display: flex;
        justify-content: space-between;
        gap: 1.8mm;
        padding: 0.9mm 0;
        border-top: 0.24mm solid #111;
        border-bottom: 0.24mm solid #111;
      }

      .occurrence-print__summary-item {
        display: grid;
        gap: 0.3mm;
        flex: 1 1 0;
      }

      .occurrence-print__summary-value,
      .occurrence-print__field-value {
        font-size: 2.7mm;
        line-height: 1.2;
      }

      .occurrence-print__details {
        display: grid;
        gap: 0.55mm;
      }

      .occurrence-print__field {
        display: grid;
        gap: 0.3mm;
        padding-bottom: 0.8mm;
        border-bottom: 0.2mm dashed #a6a6a6;
      }

      .occurrence-print__body {
        display: grid;
        gap: 0.8mm;
        padding: 1.2mm 0;
        border-top: 0.24mm solid #111;
        border-bottom: 0.24mm solid #111;
      }

      .occurrence-print__body-copy {
        min-height: 86mm;
        font-size: 3.15mm;
        line-height: 1.55;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: anywhere;
      }

      @media screen {
        body {
          margin: 0 auto;
          padding: 6mm 3mm 10mm;
          background: #f2f2f2;
        }

        .occurrence-print {
          background: #fff;
          padding: 4mm;
          box-shadow: 0 0 0 1px #d9d9d9;
        }
      }
    </style>
  </head>
  <body>
    <main class="occurrence-print">
      <section class="occurrence-print__header occurrence-print__section">
        <span class="occurrence-print__eyebrow">NEXUS</span>
        <strong class="occurrence-print__title">${escapeHtml(entry.documentTitle || 'Ocorrencia para malote')}</strong>
        <span class="occurrence-print__subtitle">${escapeHtml(entry.subtitle || 'Comunicacao interna para Financeiro / RH')}</span>
        <span class="occurrence-print__meta">${escapeHtml(entry.meta || '')}</span>
        <div class="occurrence-print__divider"></div>
      </section>

      <section class="occurrence-print__summary occurrence-print__section">
        <div class="occurrence-print__summary-item">
          <span class="occurrence-print__summary-label">Destino</span>
          <strong class="occurrence-print__summary-value">${escapeHtml(entry.destinationSector || 'Financeiro')}</strong>
        </div>
        <div class="occurrence-print__summary-item">
          <span class="occurrence-print__summary-label">Classificacao</span>
          <strong class="occurrence-print__summary-value">${escapeHtml(entry.category || 'Ocorrencia operacional')}</strong>
        </div>
      </section>

      <section class="occurrence-print__details occurrence-print__section">
        ${renderField('Titulo', entry.title)}
        ${renderField('Referencia', entry.reference)}
        ${renderField('Valor impactado', entry.amount)}
        ${renderField('Operador responsavel', entry.operatorName)}
        ${renderField('Data informada', formatPrintableDate(entry.occurredAt))}
      </section>

      <section class="occurrence-print__body occurrence-print__section">
        <span class="occurrence-print__body-title">Descricao detalhada</span>
        <div class="occurrence-print__body-copy">${escapeHtml(entry.description || 'Sem descricao adicional.')}</div>
      </section>

      <section class="occurrence-print__footer occurrence-print__section">
        <div class="occurrence-print__divider"></div>
        <span class="occurrence-print__meta">${escapeHtml(entry.footer || 'Documento para envio no malote interno.')}</span>
      </section>
    </main>
  </body>
</html>`
}

export function printOccurrenceReport(entry) {
  const printWindow = window.open('', '_blank', 'width=420,height=860')

  if (!printWindow) {
    throw new Error('Nao foi possivel abrir a janela de impressao.')
  }

  printWindow.document.open()
  printWindow.document.write(buildPrintHtml(entry))
  printWindow.document.close()
  printWindow.document.title = entry.documentTitle || 'Ocorrencia para malote'
  printWindow.focus()

  const triggerPrint = () => {
    try {
      printWindow.focus()
      printWindow.print()
    } catch {
      // Ignore print invocation errors.
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
