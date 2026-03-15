import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { assertFirebaseReady, canUseRemoteSync, firebaseDb, guardRemoteSubscription } from './firebase';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';
import { deleteInventoryItemForProduct, ensureInventoryItemForProduct } from './inventory';

function parseDecimal(value, fieldLabel) {
  const normalized = String(value ?? '')
    .replace(/\s+/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} invalido.`);
  }

  return parsed;
}

function parseInteger(value, fieldLabel) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} invalido.`);
  }

  return parsed;
}

export function normalizeProductCategory(value) {
  return String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ');
}

export function validateProductInput(values) {
  const name = values.name?.trim();
  const category = normalizeProductCategory(values.category);

  if (!name) {
    throw new Error('Informe o nome do produto.');
  }

  if (!category) {
    throw new Error('Informe a categoria do produto.');
  }

  return {
    name,
    category,
    price: parseDecimal(values.price, 'Preco'),
    cost: parseDecimal(values.cost, 'Custo'),
    stock: parseInteger(values.stock, 'Estoque'),
    minimumStock: parseInteger(values.minimumStock === '' ? 0 : (values.minimumStock ?? 0), 'Estoque minimo'),
    sku: values.sku?.trim() ?? '',
    description: values.description?.trim() ?? '',
    status: values.status?.trim() || 'active',
  };
}

function buildInventorySnapshot(storeId, tenantId, productId, product) {
  const currentStock = Number(product.stock ?? 0)
  const minimumStock = Number(product.minimumStock ?? 0)

  return {
    storeId,
    tenantId: product.tenantId ?? tenantId ?? null,
    productId,
    productName: product.name,
    category: product.category ?? '',
    sku: product.sku ?? '',
    barcode: product.barcode ?? '',
    price: Number(product.price ?? 0),
    cost: Number(product.cost ?? 0),
    currentStock,
    minimumStock,
    status: product.status ?? 'active',
    lowStock: currentStock <= minimumStock,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }
}

function getProductsCollectionRef(storeId) {
  assertFirebaseReady();
  return collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.products);
}

export function subscribeToProducts(storeId, onData, onError) {
  if (!storeId || !canUseRemoteSync()) {
    onData([]);
    return () => {};
  }

  const productsQuery = query(getProductsCollectionRef(storeId), orderBy('name'));

  return guardRemoteSubscription(
    () => onSnapshot(
      productsQuery,
      (snapshot) => {
        const products = snapshot.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        }));

        onData(products);
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

export async function createProduct({ storeId, tenantId, values }) {
  const payload = validateProductInput(values);
  const productsRef = getProductsCollectionRef(storeId);

  const productRef = await addDoc(productsRef, {
    ...payload,
    storeId,
    tenantId: tenantId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await ensureInventoryItemForProduct({
    storeId,
    tenantId,
    productId: productRef.id,
    product: payload,
  });

  return productRef.id;
}

export async function updateProduct({ storeId, productId, values }) {
  const payload = validateProductInput(values);
  const productRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.products, productId);

  await updateDoc(productRef, {
    ...payload,
    updatedAt: serverTimestamp(),
  });

  await ensureInventoryItemForProduct({
    storeId,
    productId,
    product: payload,
  });
}

export async function deleteProduct({ storeId, productId }) {
  assertFirebaseReady();
  const productRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.products, productId);
  await deleteDoc(productRef);
  await deleteInventoryItemForProduct({ storeId, productId });
}

export async function applyMinimumStockDefaults({ storeId, tenantId, products, minimumStock = 1 }) {
  assertFirebaseReady();

  const eligibleProducts = products.filter(
    (product) => Number(product.stock ?? 0) > 0 && Number(product.minimumStock ?? 0) <= 0,
  );

  if (eligibleProducts.length === 0) {
    return { updatedCount: 0 };
  }

  for (let index = 0; index < eligibleProducts.length; index += 400) {
    const batch = writeBatch(firebaseDb);
    const chunk = eligibleProducts.slice(index, index + 400);

    chunk.forEach((product) => {
      const productRef = doc(
        firebaseDb,
        FIRESTORE_COLLECTIONS.stores,
        storeId,
        FIRESTORE_COLLECTIONS.products,
        product.id,
      );
      const inventoryRef = doc(
        firebaseDb,
        FIRESTORE_COLLECTIONS.stores,
        storeId,
        FIRESTORE_COLLECTIONS.inventoryItems,
        product.id,
      );

      batch.set(productRef, {
        minimumStock,
        tenantId: product.tenantId ?? tenantId ?? null,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      batch.set(
        inventoryRef,
        buildInventorySnapshot(storeId, tenantId, product.id, {
          ...product,
          minimumStock,
        }),
        { merge: true },
      );
    });

    await batch.commit();
  }

  return { updatedCount: eligibleProducts.length };
}

export async function bulkUpdateProducts({
  storeId,
  tenantId,
  productIds,
  products,
  changes,
}) {
  assertFirebaseReady()

  const selectedIds = Array.from(new Set((productIds ?? []).filter(Boolean)))
  const selectedProducts = (products ?? []).filter((product) => selectedIds.includes(product.id))

  if (selectedProducts.length === 0) {
    return { updatedCount: 0 }
  }

  const normalizedChanges = {}

  if (Object.prototype.hasOwnProperty.call(changes, 'category')) {
    normalizedChanges.category = normalizeProductCategory(changes.category)
  }

  if (Object.prototype.hasOwnProperty.call(changes, 'minimumStock')) {
    normalizedChanges.minimumStock = parseInteger(changes.minimumStock, 'Estoque minimo')
  }

  if (Object.prototype.hasOwnProperty.call(changes, 'status')) {
    normalizedChanges.status = String(changes.status ?? '').trim() || 'active'
  }

  if (Object.prototype.hasOwnProperty.call(changes, 'price')) {
    normalizedChanges.price = parseDecimal(changes.price, 'Preco')
  }

  if (Object.prototype.hasOwnProperty.call(changes, 'cost')) {
    normalizedChanges.cost = parseDecimal(changes.cost, 'Custo')
  }

  for (let index = 0; index < selectedProducts.length; index += 350) {
    const batch = writeBatch(firebaseDb)
    const chunk = selectedProducts.slice(index, index + 350)

    chunk.forEach((product) => {
      const productRef = doc(
        firebaseDb,
        FIRESTORE_COLLECTIONS.stores,
        storeId,
        FIRESTORE_COLLECTIONS.products,
        product.id,
      )
      const inventoryRef = doc(
        firebaseDb,
        FIRESTORE_COLLECTIONS.stores,
        storeId,
        FIRESTORE_COLLECTIONS.inventoryItems,
        product.id,
      )
      const nextProduct = {
        ...product,
        ...normalizedChanges,
      }

      batch.set(productRef, {
        ...normalizedChanges,
        updatedAt: serverTimestamp(),
        tenantId: product.tenantId ?? tenantId ?? null,
      }, { merge: true })
      batch.set(
        inventoryRef,
        buildInventorySnapshot(storeId, tenantId, product.id, nextProduct),
        { merge: true },
      )
    })

    await batch.commit()
  }

  return { updatedCount: selectedProducts.length }
}

export async function normalizeProductCategories({ storeId, tenantId, products }) {
  const normalizedProducts = (products ?? []).filter((product) => {
    const normalizedCategory = normalizeProductCategory(product.category)
    return normalizedCategory && normalizedCategory !== product.category
  })

  if (normalizedProducts.length === 0) {
    return { updatedCount: 0 }
  }

  for (let index = 0; index < normalizedProducts.length; index += 350) {
    const batch = writeBatch(firebaseDb)
    const chunk = normalizedProducts.slice(index, index + 350)

    chunk.forEach((product) => {
      const nextProduct = {
        ...product,
        category: normalizeProductCategory(product.category),
      }
      const productRef = doc(
        firebaseDb,
        FIRESTORE_COLLECTIONS.stores,
        storeId,
        FIRESTORE_COLLECTIONS.products,
        product.id,
      )
      const inventoryRef = doc(
        firebaseDb,
        FIRESTORE_COLLECTIONS.stores,
        storeId,
        FIRESTORE_COLLECTIONS.inventoryItems,
        product.id,
      )

      batch.set(productRef, {
        category: nextProduct.category,
        updatedAt: serverTimestamp(),
        tenantId: product.tenantId ?? tenantId ?? null,
      }, { merge: true })
      batch.set(
        inventoryRef,
        buildInventorySnapshot(storeId, tenantId, product.id, nextProduct),
        { merge: true },
      )
    })

    await batch.commit()
  }

  return { updatedCount: normalizedProducts.length }
}
