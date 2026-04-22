import { roles } from './permissions'

const DEFAULT_TENANT_ID = 'hora-dez'
const DEFAULT_STORE_ID = 'hora-dez'

export const localOperatorProfiles = [
  { operatorName: 'Gabriel', role: roles.admin },
  { operatorName: 'Maria Eduarda', role: roles.gerente },
  { operatorName: 'Rafael', role: roles.operador },
  { operatorName: 'Ana Vitoria', role: roles.atendente },
  { operatorName: 'Ramaiane', role: roles.operador },
  { operatorName: 'Rosa', role: roles.operador },
]

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

export function getDefaultUserProfile(operatorName) {
  const trimmedName = operatorName?.trim() ?? ''
  const fallback = localOperatorProfiles.find((profile) => profile.operatorName === trimmedName)
  const uid = createLocalUserId(trimmedName)

  return {
    uid,
    operatorName: trimmedName,
    displayName: trimmedName,
    email: null,
    role: fallback?.role ?? roles.operador,
    tenantId: DEFAULT_TENANT_ID,
    storeIds: [DEFAULT_STORE_ID],
    defaultStoreId: DEFAULT_STORE_ID,
    status: 'active',
    authMode: 'local',
  }
}

export function getOperatorOptions() {
  return localOperatorProfiles.map((profile) => profile.operatorName)
}

export async function resolveUserProfileByOperator(operatorName) {
  const fallback = getDefaultUserProfile(operatorName)
  const remoteResolver = await import('./userProfilesRemote').catch(() => null)
  if (!remoteResolver?.resolveRemoteUserProfileByOperator) {
    return fallback
  }

  return remoteResolver.resolveRemoteUserProfileByOperator(fallback)
}

export async function refreshSessionProfile(session) {
  if (!session?.operatorName) {
    return session
  }

  return resolveUserProfileByOperator(session.operatorName)
}
