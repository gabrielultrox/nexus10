import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

import {
  assertFirebaseReady,
  canUseRemoteSync,
  firebaseDb,
  guardRemoteSubscription,
} from './firebase'
import { parseCustomerCsv, mapCustomerCsvRow, resolveCustomerFromImport } from './customerCsv'
import { FIRESTORE_COLLECTIONS } from './firestoreCollections'

function normalizePhone(phone) {
  return String(phone ?? '').replace(/\D/g, '')
}

export function validateCustomerInput(values) {
  const name = values.name?.trim()
  const rawPhone = values.phone?.trim()
  const phone = normalizePhone(rawPhone)

  if (!name) {
    throw new Error('Informe o nome do cliente.')
  }

  if (phone.length < 10) {
    throw new Error('Informe um telefone valido.')
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
  }
}

function getCustomersCollectionRef(storeId) {
  assertFirebaseReady()
  return collection(
    firebaseDb,
    FIRESTORE_COLLECTIONS.stores,
    storeId,
    FIRESTORE_COLLECTIONS.customers,
  )
}

export function subscribeToCustomers(storeId, onData, onError) {
  if (!storeId || !canUseRemoteSync()) {
    onData([])
    return () => {}
  }

  const customersQuery = query(getCustomersCollectionRef(storeId), orderBy('name'))

  return guardRemoteSubscription(
    () =>
      onSnapshot(
        customersQuery,
        (snapshot) => {
          const customers = snapshot.docs.map((documentSnapshot) => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data(),
          }))

          onData(customers)
        },
        onError,
      ),
    {
      onFallback() {
        onData([])
      },
      onError,
    },
  )
}

export async function createCustomer({ storeId, tenantId, values }) {
  const payload = validateCustomerInput(values)
  const customersRef = getCustomersCollectionRef(storeId)

  const customerRef = await addDoc(customersRef, {
    ...payload,
    storeId,
    tenantId: tenantId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return customerRef.id
}

export async function updateCustomer({ storeId, customerId, values }) {
  const payload = validateCustomerInput(values)
  const customerRef = doc(
    firebaseDb,
    FIRESTORE_COLLECTIONS.stores,
    storeId,
    FIRESTORE_COLLECTIONS.customers,
    customerId,
  )

  await updateDoc(customerRef, {
    ...payload,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteCustomer({ storeId, customerId }) {
  assertFirebaseReady()
  const customerRef = doc(
    firebaseDb,
    FIRESTORE_COLLECTIONS.stores,
    storeId,
    FIRESTORE_COLLECTIONS.customers,
    customerId,
  )
  await deleteDoc(customerRef)
}

export async function importCustomersFromCsv({
  storeId,
  tenantId,
  csvText,
  customers,
  mode = 'all',
}) {
  const rows = parseCustomerCsv(csvText)
  const knownCustomers = [...customers]
  const result = {
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    importedCount: 0,
    errors: [],
  }

  for (const row of rows) {
    const mappedRow = mapCustomerCsvRow(row)

    if (!mappedRow) {
      result.skippedCount += 1
      result.errors.push({
        rowNumber: row.__rowNumber,
        reason: 'Linha sem nome ou telefone valido.',
      })
      continue
    }

    const existingCustomer = resolveCustomerFromImport(knownCustomers, mappedRow)

    if (mode === 'create_only' && existingCustomer) {
      result.skippedCount += 1
      continue
    }

    if (mode === 'update_only' && !existingCustomer) {
      result.skippedCount += 1
      continue
    }

    const customerRef = existingCustomer
      ? doc(
          firebaseDb,
          FIRESTORE_COLLECTIONS.stores,
          storeId,
          FIRESTORE_COLLECTIONS.customers,
          existingCustomer.id,
        )
      : doc(
          collection(
            firebaseDb,
            FIRESTORE_COLLECTIONS.stores,
            storeId,
            FIRESTORE_COLLECTIONS.customers,
          ),
        )

    const payload = {
      ...mappedRow,
      storeId,
      tenantId: tenantId ?? null,
      createdAt: existingCustomer?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    await setDoc(customerRef, payload, { merge: true })

    if (existingCustomer) {
      const existingIndex = knownCustomers.findIndex(
        (customer) => customer.id === existingCustomer.id,
      )
      knownCustomers[existingIndex] = {
        ...existingCustomer,
        ...payload,
        id: existingCustomer.id,
      }
      result.updatedCount += 1
    } else {
      knownCustomers.push({
        ...payload,
        id: customerRef.id,
      })
      result.createdCount += 1
    }

    result.importedCount += 1
  }

  return result
}

export function previewCustomersImport({ csvText, customers, mode = 'all' }) {
  const rows = parseCustomerCsv(csvText)
  const result = {
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    importedCount: 0,
    errors: [],
  }

  rows.forEach((row) => {
    const mappedRow = mapCustomerCsvRow(row)

    if (!mappedRow) {
      result.skippedCount += 1
      result.errors.push({
        rowNumber: row.__rowNumber,
        reason: 'Linha sem nome ou telefone valido.',
      })
      return
    }

    const existingCustomer = resolveCustomerFromImport(customers, mappedRow)

    if (mode === 'create_only' && existingCustomer) {
      result.skippedCount += 1
      return
    }

    if (mode === 'update_only' && !existingCustomer) {
      result.skippedCount += 1
      return
    }

    if (existingCustomer) {
      result.updatedCount += 1
    } else {
      result.createdCount += 1
    }

    result.importedCount += 1
  })

  return result
}
