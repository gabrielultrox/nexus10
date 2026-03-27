export const localOperatorProfiles = [
  { operatorName: 'Gabriel', role: 'admin' },
  { operatorName: 'Maria Eduarda', role: 'gerente' },
  { operatorName: 'Rafael', role: 'operador' },
  { operatorName: 'Ana Vitoria', role: 'atendente' },
  { operatorName: 'Rosa', role: 'operador' },
]

const DEFAULT_TENANT_ID = 'hora-dez'
const DEFAULT_STORE_ID = 'hora-dez'

function slugifyOperatorName(operatorName) {
  return operatorName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function createLocalUserId(operatorName) {
  return `local-${slugifyOperatorName(operatorName)}`
}

export function getLocalOperatorProfile(operatorName) {
  const trimmedName = String(operatorName ?? '').trim()
  const baseProfile = localOperatorProfiles.find((profile) => profile.operatorName === trimmedName)

  return {
    uid: createLocalUserId(trimmedName),
    operatorName: trimmedName,
    displayName: trimmedName,
    email: null,
    role: baseProfile?.role ?? 'operador',
    tenantId: DEFAULT_TENANT_ID,
    storeIds: [DEFAULT_STORE_ID],
    defaultStoreId: DEFAULT_STORE_ID,
    status: 'active',
    authMode: 'custom-token',
  }
}
