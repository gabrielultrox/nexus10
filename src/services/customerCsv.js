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

function normalizePhone(phone) {
  return String(phone ?? '').replace(/\D/g, '');
}

export function parseCustomerCsv(text) {
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

export function mapCustomerCsvRow(row) {
  const name = row.nome || row.cliente || row.name || '';
  const phoneDisplay = row.telefone || row.phone || row.celular || '';
  const phone = normalizePhone(phoneDisplay);

  if (!name.trim() || phone.length < 10) {
    return null;
  }

  return {
    name: name.trim(),
    phone,
    phoneDisplay: phoneDisplay.trim(),
    neighborhood: (row.bairro || row.neighborhood || '').trim(),
    addressLine: (row.endereco || row.address || row.addressline || '').trim(),
    reference: (row.referencia || row.reference || '').trim(),
    notes: (row.observacoes || row.notes || '').trim(),
    status: (row.status || 'active').trim() || 'active',
  };
}

export function resolveCustomerFromImport(customers, importRow) {
  const normalizedPhone = importRow.phone;
  const normalizedName = importRow.name.toLowerCase();

  return customers.find((customer) => (
    (normalizedPhone && String(customer.phone ?? '') === normalizedPhone)
    || customer.name?.toLowerCase() === normalizedName
  )) ?? null;
}
