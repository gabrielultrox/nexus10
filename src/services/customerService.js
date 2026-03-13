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

import { assertFirebaseReady, canUseRemoteSync, firebaseDb, guardRemoteSubscription } from './firebase';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';

function normalizePhone(phone) {
  return String(phone ?? '').replace(/\D/g, '');
}

export function validateCustomerInput(values) {
  const name = values.name?.trim();
  const rawPhone = values.phone?.trim();
  const phone = normalizePhone(rawPhone);

  if (!name) {
    throw new Error('Informe o nome do cliente.');
  }

  if (phone.length < 10) {
    throw new Error('Informe um telefone valido.');
  }

  return {
    name,
    phone,
    phoneDisplay: rawPhone,
    neighborhood: values.neighborhood?.trim() ?? '',
    addressLine: values.addressLine?.trim() ?? '',
    reference: values.reference?.trim() ?? '',
    notes: values.notes?.trim() ?? '',
    status: values.status?.trim() || 'active',
  };
}

function getCustomersCollectionRef(storeId) {
  assertFirebaseReady();
  return collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.customers);
}

export function subscribeToCustomers(storeId, onData, onError) {
  if (!storeId || !canUseRemoteSync()) {
    onData([]);
    return () => {};
  }

  const customersQuery = query(getCustomersCollectionRef(storeId), orderBy('name'));

  return guardRemoteSubscription(
    () => onSnapshot(
      customersQuery,
      (snapshot) => {
        const customers = snapshot.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        }));

        onData(customers);
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

export async function createCustomer({ storeId, tenantId, values }) {
  const payload = validateCustomerInput(values);
  const customersRef = getCustomersCollectionRef(storeId);

  const customerRef = await addDoc(customersRef, {
    ...payload,
    storeId,
    tenantId: tenantId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return customerRef.id;
}

export async function updateCustomer({ storeId, customerId, values }) {
  const payload = validateCustomerInput(values);
  const customerRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.customers, customerId);

  await updateDoc(customerRef, {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCustomer({ storeId, customerId }) {
  assertFirebaseReady();
  const customerRef = doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.customers, customerId);
  await deleteDoc(customerRef);
}
