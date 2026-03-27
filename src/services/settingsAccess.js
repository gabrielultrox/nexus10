const SETTINGS_MASTER_PASSWORD = 'GaB#@730'
const SETTINGS_UNLOCK_STORAGE_KEY = 'nexus10.settingsUnlocked'

export function isSettingsUnlocked() {
  return window.sessionStorage.getItem(SETTINGS_UNLOCK_STORAGE_KEY) === 'true'
}

export function unlockSettings(password) {
  if (password !== SETTINGS_MASTER_PASSWORD) {
    throw new Error('Senha mestra invalida.')
  }

  window.sessionStorage.setItem(SETTINGS_UNLOCK_STORAGE_KEY, 'true')
}

export function lockSettings() {
  window.sessionStorage.removeItem(SETTINGS_UNLOCK_STORAGE_KEY)
}
