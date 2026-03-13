function normalizeCsvHeader(header) {
  return String(header ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function parseCsvLine(line, delimiter) {
  const values = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }

      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === delimiter && !insideQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, '').trim());
}

function parseOptionalDecimal(value) {
  if (value == null) {
    return null;
  }

  const normalized = String(value)
    .trim()
    .replace(/\./g, '')
    .replace(',', '.');

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInteger(value) {
  if (value == null || String(value).trim() === '') {
    return null;
  }

  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

export function parseInventoryCsv(text) {
  const lines = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('Arquivo CSV sem linhas suficientes para importacao.');
  }

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = parseCsvLine(lines[0], delimiter).map(normalizeCsvHeader);

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line, delimiter);
    const row = headers.reduce((accumulator, header, headerIndex) => {
      accumulator[header] = values[headerIndex] ?? '';
      return accumulator;
    }, {});

    return {
      __rowNumber: index + 2,
      ...row,
    };
  });
}

export function mapInventoryCsvRow(row) {
  const externalCode = row.codigo || row.productid || row.id || row.sku || '';
  const name = row.nome || row.produto || row.product || row.name || '';
  const stock = parseOptionalInteger(row.estoque ?? row.currentstock ?? row.stock) ?? 0;
  const minimumStock = parseOptionalInteger(
    row.minimumstock
      ?? row.minimostock
      ?? row.estoqueminimo
      ?? row.minimo,
  ) ?? 0;
  const cashPrice = parseOptionalDecimal(row.avista);
  const termPrice = parseOptionalDecimal(row.aprazo);
  const cost = parseOptionalDecimal(row.pfinalcusto ?? row.cost ?? row.custo);
  const barcode = row.codbarra || row.barcode || '';
  const brand = row.marca || '';
  const taxGroup = row.grupofiscal || '';
  const category = brand || taxGroup || 'Importacao CSV';
  const unit = row.un || row.unidade || 'UN';
  const salePrice = cashPrice ?? termPrice ?? cost ?? 0;

  if (!name.trim()) {
    return null;
  }

  return {
    externalCode: externalCode.trim(),
    name: name.trim(),
    stock,
    minimumStock,
    price: salePrice,
    cost: cost ?? 0,
    category: category.trim(),
    barcode: barcode.trim(),
    brand: brand.trim(),
    taxGroup: taxGroup.trim(),
    unit: unit.trim(),
    reference: row.refi?.trim() ?? '',
    description: [
      brand ? `Marca: ${brand.trim()}` : '',
      barcode ? `Cod. barra: ${barcode.trim()}` : '',
      row.ncm ? `NCM: ${row.ncm.trim()}` : '',
      row.cest ? `CEST: ${row.cest.trim()}` : '',
      row.tributacao ? `Tributacao: ${row.tributacao.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' | '),
  };
}

export function resolveProductFromImport(products, importRow) {
  const normalizedCode = importRow.externalCode?.toLowerCase();
  const normalizedName = importRow.name.toLowerCase();
  const normalizedBarcode = importRow.barcode?.toLowerCase();

  return products.find((product) => {
    const productSku = product.sku?.toLowerCase();
    const productName = product.name?.toLowerCase();
    const productBarcode = product.barcode?.toLowerCase();

    return (
      (normalizedCode && product.id === normalizedCode)
      || (normalizedCode && productSku === normalizedCode)
      || (normalizedBarcode && productBarcode === normalizedBarcode)
      || productName === normalizedName
    );
  }) ?? null;
}

export function createImportedProductId(importRow) {
  const rawValue = importRow.externalCode || importRow.barcode || importRow.name;
  const slug = String(rawValue)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  return `csv-${slug || 'produto'}`;
}
