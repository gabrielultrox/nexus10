export const ACCESS_PIN_STORAGE_KEY = 'hd2_pin';
export const DEFAULT_ACCESS_PIN = '0101';

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export function getStoredPin() {
  return getStorage()?.getItem(ACCESS_PIN_STORAGE_KEY) ?? '';
}

export function hasStoredPin() {
  return getStoredPin().length === 4;
}

export function getAccessPin() {
  return hasStoredPin() ? getStoredPin() : DEFAULT_ACCESS_PIN;
}

export function verifyStoredPin(candidate) {
  return getAccessPin() === candidate;
}

export function setStoredPin(pin) {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('O PIN deve conter 4 numeros.');
  }

  getStorage()?.setItem(ACCESS_PIN_STORAGE_KEY, pin);
}

export function clearStoredPin() {
  getStorage()?.removeItem(ACCESS_PIN_STORAGE_KEY);
}
