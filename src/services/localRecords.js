export function loadLocalRecords(storageKey, fallback = []) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) {
      return fallback;
    }

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue : fallback;
  } catch (error) {
    return fallback;
  }
}

export function saveLocalRecords(storageKey, records) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(records));
  } catch (error) {
    // Ignore storage write failures to keep the operational shell usable.
  }
}

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

function getResetMetaKey(storageKey) {
  return `${storageKey}::operational-day`;
}

export function loadResettableLocalRecords(storageKey, fallback = [], resetHour = 3) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const operationalDay = getOperationalDay(resetHour);
  const resetMetaKey = getResetMetaKey(storageKey);

  try {
    const savedOperationalDay = window.localStorage.getItem(resetMetaKey);

    if (savedOperationalDay !== operationalDay) {
      window.localStorage.setItem(storageKey, JSON.stringify(fallback));
      window.localStorage.setItem(resetMetaKey, operationalDay);
      return fallback;
    }
  } catch (error) {
    return fallback;
  }

  return loadLocalRecords(storageKey, fallback);
}

export function saveResettableLocalRecords(storageKey, records, resetHour = 3) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(getResetMetaKey(storageKey), getOperationalDay(resetHour));
  } catch (error) {
    // Ignore metadata write failures to keep the operational shell usable.
  }

  saveLocalRecords(storageKey, records);
}

export function resetLocalRecordsNow(storageKey, fallback = [], resetHour = 3) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(fallback));
    window.localStorage.setItem(getResetMetaKey(storageKey), getOperationalDay(resetHour));
  } catch (error) {
    return fallback;
  }

  return fallback;
}
