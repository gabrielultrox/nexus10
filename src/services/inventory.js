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
import {
  createImportedProductId,
  mapInventoryCsvRow,
  parseInventoryCsv,
  resolveProductFromImport,
} from './inventoryCsv';

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

export async function importInventoryFromCsv({ storeId, tenantId, csvText, products }) {
  const rows = parseInventoryCsv(csvText);
  const knownProducts = [...products];
  const result = {
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    importedCount: 0,
  };

  for (const row of rows) {
    const mappedRow = mapInventoryCsvRow(row);

    if (!mappedRow) {
      result.skippedCount += 1;
      continue;
    }

    const existingProduct = resolveProductFromImport(knownProducts, mappedRow);
    const productId = existingProduct?.id ?? createImportedProductId(mappedRow);
    const productRef = getProductRef(storeId, productId);
    const productPayload = {
      name: mappedRow.name,
      category: existingProduct?.category || mappedRow.category,
      price: mappedRow.price,
      cost: mappedRow.cost,
      stock: mappedRow.stock,
      minimumStock: mappedRow.minimumStock,
      sku: mappedRow.externalCode || existingProduct?.sku || '',
      barcode: mappedRow.barcode || existingProduct?.barcode || '',
      description: mappedRow.description || existingProduct?.description || '',
      status: existingProduct?.status || 'active',
      storeId,
      tenantId: tenantId ?? null,
      updatedAt: serverTimestamp(),
      createdAt: existingProduct?.createdAt ?? serverTimestamp(),
    };

    await setDoc(productRef, productPayload, { merge: true });

    await applyInventoryMovement({
      storeId,
      tenantId,
      productId,
      movementType: 'csv_import',
      quantity: mappedRow.stock,
      reason: 'Importacao de estoque via CSV',
      source: 'manual',
      movementId: `csv-import-${productId}-${row.__rowNumber}`,
      productSnapshot: {
        ...existingProduct,
        ...productPayload,
        productName: productPayload.name,
      },
      minimumStockOverride: mappedRow.minimumStock,
    });

    if (existingProduct) {
      const existingIndex = knownProducts.findIndex((product) => product.id === existingProduct.id);
      knownProducts[existingIndex] = {
        ...existingProduct,
        ...productPayload,
        id: productId,
      };
      result.updatedCount += 1;
    } else {
      knownProducts.push({
        ...productPayload,
        id: productId,
      });
      result.createdCount += 1;
    }

    result.importedCount += 1;
  }

  return result;
}
