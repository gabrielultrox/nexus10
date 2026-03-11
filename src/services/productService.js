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
} from 'firebase/firestore';

import { assertFirebaseReady, firebaseDb } from './firebase';
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

export function validateProductInput(values) {
  const name = values.name?.trim();
  const category = values.category?.trim();

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

function getProductsCollectionRef(storeId) {
  assertFirebaseReady();
  return collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.products);
}

export function subscribeToProducts(storeId, onData, onError) {
  const productsQuery = query(getProductsCollectionRef(storeId), orderBy('name'));

  return onSnapshot(
    productsQuery,
    (snapshot) => {
      const products = snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }));

      onData(products);
    },
    onError,
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
