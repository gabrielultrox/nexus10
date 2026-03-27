export const ACCESS_PIN_STORAGE_KEY = 'hd2_pin'
export const DEFAULT_ACCESS_PIN = '0101'

function getStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}

export function getStoredPin() {
  return getStorage()?.getItem(ACCESS_PIN_STORAGE_KEY) ?? ''
}

export function hasStoredPin() {
  return getStoredPin().length === 4
}

export function getAccessPin() {
  return hasStoredPin() ? getStoredPin() : DEFAULT_ACCESS_PIN
}

export function verifyStoredPin(candidate) {
  return getAccessPin() === candidate
}

export function setStoredPin(pin) {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('O PIN deve conter 4 numeros.')
  }

  getStorage()?.setItem(ACCESS_PIN_STORAGE_KEY, pin)
}

export function clearStoredPin() {
  getStorage()?.removeItem(ACCESS_PIN_STORAGE_KEY)
}

export function loadLocalRecords(storageKey, fallback = []) {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey)

    if (!rawValue) {
      return fallback
    }

    const parsedValue = JSON.parse(rawValue)
    return Array.isArray(parsedValue) ? parsedValue : fallback
  } catch {
    return fallback
  }
}

export function saveLocalRecords(storageKey, records) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(records))
  } catch {
    // Ignore storage write failures to keep the operational shell usable.
  }
}

function getOperationalDay(resetHour = 3) {
  const now = new Date()
  const operationalDate = new Date(now)

  if (now.getHours() < resetHour) {
    operationalDate.setDate(operationalDate.getDate() - 1)
  }

  const year = operationalDate.getFullYear()
  const month = String(operationalDate.getMonth() + 1).padStart(2, '0')
  const day = String(operationalDate.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getResetMetaKey(storageKey) {
  return `${storageKey}::operational-day`
}

export function loadResettableLocalRecords(storageKey, fallback = [], resetHour = 3) {
  if (typeof window === 'undefined') {
    return fallback
  }

  const operationalDay = getOperationalDay(resetHour)
  const resetMetaKey = getResetMetaKey(storageKey)

  try {
    const savedOperationalDay = window.localStorage.getItem(resetMetaKey)

    if (savedOperationalDay !== operationalDay) {
      window.localStorage.setItem(storageKey, JSON.stringify(fallback))
      window.localStorage.setItem(resetMetaKey, operationalDay)
      return fallback
    }
  } catch {
    return fallback
  }

  return loadLocalRecords(storageKey, fallback)
}

export function saveResettableLocalRecords(storageKey, records, resetHour = 3) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(getResetMetaKey(storageKey), getOperationalDay(resetHour))
  } catch {
    // Ignore metadata write failures to keep the operational shell usable.
  }

  saveLocalRecords(storageKey, records)
}

export function resetLocalRecordsNow(storageKey, fallback = [], resetHour = 3) {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(fallback))
    window.localStorage.setItem(getResetMetaKey(storageKey), getOperationalDay(resetHour))
  } catch {
    return fallback
  }

  return fallback
}
