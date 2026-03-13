import fs from 'node:fs';
import path from 'node:path';

import admin from 'firebase-admin';

import { getAdminFirestore } from '../firebaseAdmin.js';
import { FIRESTORE_COLLECTIONS } from '../../src/services/firestoreCollections.js';
import {
  createImportedProductId,
  mapInventoryCsvRow,
  parseInventoryCsv,
  resolveProductFromImport,
} from '../../src/services/inventoryCsv.js';

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function getCollectionRef(db, storeId, collectionName) {
  return db.collection(FIRESTORE_COLLECTIONS.stores).doc(storeId).collection(collectionName);
}

async function commitBatch(batch, writesCount) {
  if (writesCount === 0) {
    return 0;
  }

  await batch.commit();
  return 0;
}

async function main() {
  const storeId = getArgValue('--store') ?? 'hora-dez';
  const tenantId = getArgValue('--tenant') ?? storeId;
  const csvFilePath = path.resolve(getArgValue('--file') ?? 'C:/Users/User/Desktop/produtos.csv');
  const rawCsv = fs.readFileSync(csvFilePath, 'utf8');
  const db = getAdminFirestore();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const productsRef = getCollectionRef(db, storeId, FIRESTORE_COLLECTIONS.products);
  const inventoryItemsRef = getCollectionRef(db, storeId, FIRESTORE_COLLECTIONS.inventoryItems);
  const inventoryMovementsRef = getCollectionRef(db, storeId, FIRESTORE_COLLECTIONS.inventoryMovements);

  const [productSnapshot, inventorySnapshot] = await Promise.all([
    productsRef.get(),
    inventoryItemsRef.get(),
  ]);

  const knownProducts = productSnapshot.docs.map((documentSnapshot) => ({
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  }));
  const inventoryMap = new Map(
    inventorySnapshot.docs.map((documentSnapshot) => [
      documentSnapshot.id,
      {
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      },
    ]),
  );

  const rows = parseInventoryCsv(rawCsv);
  let result = {
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    importedCount: 0,
  };

  let batch = db.batch();
  let writesCount = 0;

  async function queueSet(reference, payload, options = undefined) {
    if (options) {
      batch.set(reference, payload, options);
    } else {
      batch.set(reference, payload);
    }

    writesCount += 1;

    if (writesCount >= 300) {
      await commitBatch(batch, writesCount);
      batch = db.batch();
      writesCount = 0;
    }
  }

  for (const row of rows) {
    const mappedRow = mapInventoryCsvRow(row);

    if (!mappedRow) {
      result.skippedCount += 1;
      continue;
    }

    const existingProduct = resolveProductFromImport(knownProducts, mappedRow);
    const productId = existingProduct?.id ?? createImportedProductId(mappedRow);
    const inventoryItem = inventoryMap.get(productId);
    const previousStock = Number(inventoryItem?.currentStock ?? existingProduct?.stock ?? 0);
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
      tenantId,
      createdAt: existingProduct?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    await queueSet(productsRef.doc(productId), productPayload, { merge: true });
    await queueSet(
      inventoryItemsRef.doc(productId),
      {
        storeId,
        tenantId,
        productId,
        productName: productPayload.name,
        category: productPayload.category,
        sku: productPayload.sku,
        currentStock: mappedRow.stock,
        minimumStock: mappedRow.minimumStock,
        status: productPayload.status,
        lowStock: mappedRow.stock <= mappedRow.minimumStock,
        createdAt: inventoryItem?.createdAt ?? timestamp,
        updatedAt: timestamp,
      },
      { merge: true },
    );
    await queueSet(inventoryMovementsRef.doc(), {
      storeId,
      tenantId,
      productId,
      productName: productPayload.name,
      category: productPayload.category,
      sku: productPayload.sku,
      movementType: 'csv_import',
      quantity: mappedRow.stock,
      reason: 'Importacao de estoque via CSV',
      source: 'manual',
      relatedSaleId: null,
      previousStock,
      resultingStock: mappedRow.stock,
      createdAt: timestamp,
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

    inventoryMap.set(productId, {
      ...inventoryItem,
      productId,
      productName: productPayload.name,
      currentStock: mappedRow.stock,
      minimumStock: mappedRow.minimumStock,
    });
    result.importedCount += 1;
  }

  await commitBatch(batch, writesCount);

  console.log(
    JSON.stringify(
      {
        storeId,
        tenantId,
        file: csvFilePath,
        ...result,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
