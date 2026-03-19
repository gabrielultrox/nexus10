import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

import { firebaseDb, firebaseReady, guardRemoteSubscription } from './firebase';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';
import { loadLocalRecords, saveLocalRecords } from './localAccess';

function getOperationalDay(resetHour = 3) {
  const now = new Date();
  const operationalDate = new Date(now);

  if (now.getHours() < resetHour) {
    operationalDate.setDate(operationalDate.getDate() - 1);
  }

  const year = operationalDate.getFullYear();
  const month = String(operationalDate.getMonth() + 1).padStart(2, '0');
  const day = String(operationalDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function createDefaultCashState(resetHour = 3) {
  return {
    status: 'fechado',
    openedAt: '',
    closedAt: '',
    initialBalance: 0,
    currentBalance: 0,
    pendingCount: 0,
    operationalDay: getOperationalDay(resetHour),
  };
}

function normalizeCashState(nextState, resetHour = 3) {
  const fallback = createDefaultCashState(resetHour);

  if (!nextState || typeof nextState !== 'object') {
    return fallback;
  }

  const operationalDay = nextState.operationalDay || fallback.operationalDay;

  if (operationalDay !== fallback.operationalDay) {
    return fallback;
  }

  return {
    status: nextState.status === 'aberto' ? 'aberto' : 'fechado',
    openedAt: nextState.openedAt || '',
    closedAt: nextState.closedAt || '',
    initialBalance: Number(nextState.initialBalance ?? 0) || 0,
    currentBalance: Number(nextState.currentBalance ?? 0) || 0,
    pendingCount: Number(nextState.pendingCount ?? 0) || 0,
    operationalDay,
  };
}

function getCashStateDocRef(storeId) {
  return doc(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.settings, 'cash_status');
}

export function loadCashState(storageKey, resetHour = 3) {
  const [storedState] = loadLocalRecords(storageKey, [createDefaultCashState(resetHour)]);
  return normalizeCashState(storedState, resetHour);
}

export function saveCashStateLocal(storageKey, state, resetHour = 3) {
  saveLocalRecords(storageKey, [normalizeCashState(state, resetHour)]);
}

export function subscribeToCashState({
  storeId,
  storageKey,
  resetHour = 3,
  onData,
  onError,
}) {
  const fallbackState = loadCashState(storageKey, resetHour);

  if (!firebaseReady || !firebaseDb || !storeId) {
    onData(fallbackState);
    return () => {};
  }

  return guardRemoteSubscription(
    () =>
      onSnapshot(
        getCashStateDocRef(storeId),
        (snapshot) => {
          const normalized = normalizeCashState(snapshot.exists() ? snapshot.data() : null, resetHour);
          saveCashStateLocal(storageKey, normalized, resetHour);
          onData(normalized);
        },
        (error) => {
          onData(fallbackState);
          onError?.(error);
        },
      ),
    {
      onFallback() {
        onData(fallbackState);
      },
      onError,
    },
  );
}

export async function saveCashState({
  storeId,
  tenantId,
  storageKey,
  state,
  resetHour = 3,
}) {
  const normalized = normalizeCashState(state, resetHour);
  saveCashStateLocal(storageKey, normalized, resetHour);

  if (!firebaseReady || !firebaseDb || !storeId) {
    return false;
  }

  await setDoc(
    getCashStateDocRef(storeId),
    {
      ...normalized,
      storeId,
      tenantId: tenantId ?? null,
      updatedAtServer: serverTimestamp(),
      updatedAtClient: new Date().toISOString(),
    },
    { merge: true },
  );

  return true;
}

export { getOperationalDay };
