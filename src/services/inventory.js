import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { assertFirebaseReady, canUseRemoteSync, firebaseDb, guardRemoteSubscription } from './firebase';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';

const decrementTypes = new Set(['sale', 'manual_out']);
const incrementTypes = new Set(['manual_in', 'sale_reversal']);
const supportedMovementTypes = new Set(['manual_in', 'manual_out', 'manual_set', 'sale', 'sale_reversal', 'csv_import']);

function parseInteger(value, fieldLabel) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} invalido.`);
  }

  return parsed;
}

function mapSnapshot(snapshot) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

function getInventoryItemsCollectionRef(storeId) {
  assertFirebaseReady();
  return collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.inventoryItems);
}

function getInventoryMovementsCollectionRef(storeId) {
  assertFirebaseReady();
  return collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.inventoryMovements);
}

function getInventoryItemRef(storeId, productId) {
  assertFirebaseReady();
  return doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.inventoryItems, productId);
}

function getInventoryMovementRef(storeId, movementId) {
  assertFirebaseReady();
  return doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.inventoryMovements, movementId);
}

function getProductRef(storeId, productId) {
  assertFirebaseReady();
  return doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.products, productId);
}

function resolveNextStock(currentStock, movementType, quantity) {
  if (movementType === 'manual_set' || movementType === 'csv_import') {
    return quantity;
  }

  if (decrementTypes.has(movementType)) {
    return currentStock - quantity;
  }

  if (incrementTypes.has(movementType)) {
    return currentStock + quantity;
  }

  throw new Error('Tipo de movimentacao de estoque invalido.');
}

function normalizeProductSnapshot(productId, product, fallbackData = {}) {
  return {
    productId,
    productName: product?.name ?? fallbackData.productName ?? 'Produto',
    category: product?.category ?? fallbackData.category ?? '',
    sku: product?.sku ?? fallbackData.sku ?? '',
    minimumStock: Number(product?.minimumStock ?? fallbackData.minimumStock ?? 0),
    currentStock: Number(product?.stock ?? fallbackData.currentStock ?? 0),
    status: product?.status ?? fallbackData.status ?? 'active',
  };
}

function buildMovementPayload({
  storeId,
  tenantId,
  productId,
  snapshot,
  movementType,
  quantity,
  reason,
  source,
  relatedSaleId,
  previousStock,
  resultingStock,
}) {
  return {
    storeId,
    tenantId: tenantId ?? null,
    productId,
    productName: snapshot.productName,
    category: snapshot.category,
    sku: snapshot.sku,
    movementType,
    quantity,
    reason,
    source,
    relatedSaleId: relatedSaleId ?? null,
    previousStock,
    resultingStock,
    createdAt: serverTimestamp(),
  };
}

export function subscribeToInventoryItems(storeId, onData, onError) {
  if (!storeId || !canUseRemoteSync()) {
    onData([]);
    return () => {};
  }

  const inventoryQuery = query(getInventoryItemsCollectionRef(storeId), orderBy('productName'));

  return guardRemoteSubscription(
    () => onSnapshot(
      inventoryQuery,
      (snapshot) => {
        onData(snapshot.docs.map(mapSnapshot));
      },
      onError,
    ),
    {
      onFallback() {
        onData([]);
      },
      onError,
    },
  );
}

export function subscribeToInventoryMovements(storeId, onData, onError) {
  if (!storeId || !canUseRemoteSync()) {
    onData([]);
    return () => {};
  }

  const movementsQuery = query(getInventoryMovementsCollectionRef(storeId), orderBy('createdAt', 'desc'));

  return guardRemoteSubscription(
    () => onSnapshot(
      movementsQuery,
      (snapshot) => {
        onData(snapshot.docs.map(mapSnapshot));
      },
      onError,
    ),
    {
      onFallback() {
        onData([]);
      },
      onError,
    },
  );
}

export async function ensureInventoryItemForProduct({ storeId, tenantId, productId, product }) {
  assertFirebaseReady();

  const snapshot = normalizeProductSnapshot(productId, product);
  const inventoryRef = getInventoryItemRef(storeId, productId);

  await runTransaction(firebaseDb, async (transaction) => {
    const inventoryDoc = await transaction.get(inventoryRef);
    const existingData = inventoryDoc.exists() ? inventoryDoc.data() : null;

    transaction.set(inventoryRef, {
      storeId,
      tenantId: tenantId ?? null,
      productId,
      productName: snapshot.productName,
      category: snapshot.category,
      sku: snapshot.sku,
      currentStock: Number(product?.stock ?? existingData?.currentStock ?? 0),
      minimumStock: Number(product?.minimumStock ?? existingData?.minimumStock ?? 0),
      status: snapshot.status,
      createdAt: existingData?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
}

export async function deleteInventoryItemForProduct({ storeId, productId }) {
  await deleteDoc(getInventoryItemRef(storeId, productId));
}

export function validateInventoryAdjustmentInput(values) {
  const productId = values.productId?.trim();
  const movementType = values.movementType?.trim() || 'manual_in';
  const reason = values.reason?.trim();

  if (!productId) {
    throw new Error('Selecione um produto.');
  }

  if (!supportedMovementTypes.has(movementType)) {
    throw new Error('Tipo de movimentacao invalido.');
  }

  if (!reason) {
    throw new Error('Informe o motivo da movimentacao.');
  }

  return {
    productId,
    movementType,
    quantity: parseInteger(values.quantity, 'Quantidade'),
    reason,
  };
}

export async function applyInventoryMovement({
  storeId,
  tenantId,
  productId,
  movementType,
  quantity,
  reason,
  source = 'manual',
  relatedSaleId = null,
  movementId = null,
  productSnapshot = null,
  minimumStockOverride = null,
}) {
  assertFirebaseReady();

  if (!supportedMovementTypes.has(movementType)) {
    throw new Error('Tipo de movimentacao invalido.');
  }

  const inventoryRef = getInventoryItemRef(storeId, productId);
  const productRef = getProductRef(storeId, productId);
  const movementRef = movementId
    ? getInventoryMovementRef(storeId, movementId)
    : doc(getInventoryMovementsCollectionRef(storeId));

  await runTransaction(firebaseDb, async (transaction) => {
    const [inventoryDoc, productDoc, movementDoc] = await Promise.all([
      transaction.get(inventoryRef),
      transaction.get(productRef),
      transaction.get(movementRef),
    ]);

    if (movementDoc.exists()) {
      return;
    }

    const productData = productDoc.exists() ? productDoc.data() : null;
    const snapshot = normalizeProductSnapshot(productId, productSnapshot ?? productData, inventoryDoc.data());
    const currentStock = Number(inventoryDoc.data()?.currentStock ?? snapshot.currentStock ?? 0);
    const minimumStock = minimumStockOverride != null
      ? Number(minimumStockOverride)
      : Number(inventoryDoc.data()?.minimumStock ?? snapshot.minimumStock ?? 0);
    const nextStock = resolveNextStock(currentStock, movementType, quantity);

    if (nextStock < 0) {
      throw new Error(`Estoque insuficiente para ${snapshot.productName}.`);
    }

    transaction.set(inventoryRef, {
      storeId,
      tenantId: tenantId ?? null,
      productId,
      productName: snapshot.productName,
      category: snapshot.category,
      sku: snapshot.sku,
      currentStock: nextStock,
      minimumStock,
      status: snapshot.status,
      lowStock: nextStock <= minimumStock,
      createdAt: inventoryDoc.data()?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    if (productDoc.exists()) {
      transaction.set(productRef, {
        stock: nextStock,
        minimumStock,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    transaction.set(movementRef, buildMovementPayload({
      storeId,
      tenantId,
      productId,
      snapshot,
      movementType,
      quantity,
      reason,
      source,
      relatedSaleId,
      previousStock: currentStock,
      resultingStock: nextStock,
    }));
  });

  return movementRef.id;
}

export async function adjustInventoryManually({ storeId, tenantId, values }) {
  const payload = validateInventoryAdjustmentInput(values);

  return applyInventoryMovement({
    storeId,
    tenantId,
    ...payload,
    source: 'manual',
  });
}

function normalizeCsvHeader(header) {
  return String(header ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseCsv(text) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('Arquivo CSV sem linhas suficientes para importacao.');
  }

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map(normalizeCsvHeader);

  return lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((item) => item.trim().replace(/^"|"$/g, ''));
    return headers.reduce((accumulator, header, index) => {
      accumulator[header] = values[index] ?? '';
      return accumulator;
    }, {});
  });
}

function resolveProductFromCsvRow(products, row) {
  const byId = row.productid || row.id;
  const bySku = row.sku;
  const byName = row.nome || row.produto || row.product || row.name;

  return products.find((product) => (
    (byId && product.id === byId)
    || (bySku && product.sku?.toLowerCase() === bySku.toLowerCase())
    || (byName && product.name?.toLowerCase() === byName.toLowerCase())
  ));
}

export async function importInventoryFromCsv({ storeId, tenantId, csvText, products }) {
  const rows = parseCsv(csvText);
  let importedCount = 0;

  for (const row of rows) {
    const product = resolveProductFromCsvRow(products, row);

    if (!product) {
      continue;
    }

    const currentStock = parseInteger(row.currentstock || row.stock || row.estoque, 'Estoque atual');
    const minimumStock = parseInteger(row.minimumstock || row.minimostock || row.estoqueminimo || row.minimo || 0, 'Estoque minimo');

    await applyInventoryMovement({
      storeId,
      tenantId,
      productId: product.id,
      movementType: 'csv_import',
      quantity: currentStock,
      reason: 'Importacao de estoque via CSV',
      source: 'manual',
      movementId: `csv-import-${product.id}-${Date.now()}`,
      productSnapshot: {
        ...product,
        stock: currentStock,
        minimumStock,
      },
      minimumStockOverride: minimumStock,
    });

    importedCount += 1;
  }

  return importedCount;
}
