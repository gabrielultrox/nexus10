const OPERATOR_PASSWORDS_STORAGE_KEY = 'nexus10.operator-passwords'
export const DEFAULT_OPERATOR_PASSWORD = '01'

function getStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}

function normalizeOperatorName(operatorName) {
  return String(operatorName ?? '')
    .trim()
    .toLowerCase()
}

function loadPasswordMap() {
  const storage = getStorage()

  if (!storage) {
    return {}
  }

  try {
    const rawValue = storage.getItem(OPERATOR_PASSWORDS_STORAGE_KEY)

    if (!rawValue) {
      return {}
    }

    const parsedValue = JSON.parse(rawValue)
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : {}
  } catch {
    return {}
  }
}

function savePasswordMap(nextMap) {
  const storage = getStorage()

  if (!storage) {
    return
  }

  storage.setItem(OPERATOR_PASSWORDS_STORAGE_KEY, JSON.stringify(nextMap))
}

export function getOperatorStoredPassword(operatorName) {
  const normalizedName = normalizeOperatorName(operatorName)

  if (!normalizedName) {
    return ''
  }

  return String(loadPasswordMap()[normalizedName] ?? '')
}

export function hasCustomOperatorPassword(operatorName) {
  return getOperatorStoredPassword(operatorName).length > 0
}

export function getOperatorAccessPassword(operatorName) {
  return hasCustomOperatorPassword(operatorName)
    ? getOperatorStoredPassword(operatorName)
    : DEFAULT_OPERATOR_PASSWORD
}

export function verifyOperatorPassword(operatorName, candidate) {
  return getOperatorAccessPassword(operatorName) === String(candidate ?? '')
}

export function setOperatorPassword(operatorName, password) {
  const normalizedName = normalizeOperatorName(operatorName)
  const normalizedPassword = String(password ?? '').trim()

  if (!normalizedName) {
    throw new Error('Selecione um operador valido.')
  }

  if (normalizedPassword.length < 2) {
    throw new Error('A senha do operador precisa ter pelo menos 2 caracteres.')
  }

  const nextMap = loadPasswordMap()
  nextMap[normalizedName] = normalizedPassword
  savePasswordMap(nextMap)
}

export function clearOperatorPassword(operatorName) {
  const normalizedName = normalizeOperatorName(operatorName)

  if (!normalizedName) {
    return
  }

  const nextMap = loadPasswordMap()
  delete nextMap[normalizedName]
  savePasswordMap(nextMap)
}

export function getOperatorPasswordSummary(operatorName) {
  return {
    operatorName,
    hasCustomPassword: hasCustomOperatorPassword(operatorName),
    maskedPassword: hasCustomOperatorPassword(operatorName)
      ? '*'.repeat(getOperatorStoredPassword(operatorName).length)
      : DEFAULT_OPERATOR_PASSWORD,
  }
}
