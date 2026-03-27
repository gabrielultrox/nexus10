import { useAuth as useAuthContext } from '../contexts/AuthContext'

export interface IUserClaims extends Record<string, unknown> {
  operatorName?: string
  tenantId?: string | null
  storeIds?: string[]
}

export interface IUserPermissions extends Record<string, boolean> {}

export interface IUserSession {
  uid: string
  email: string | null
  displayName: string
  operatorName: string
  isAnonymous: boolean
  role: string
  roleLabel: string
  tenantId: string | null
  storeIds: string[]
  defaultStoreId?: string | null
  claims: IUserClaims
  permissions: IUserPermissions
}

export interface ISignInCredentials {
  operatorName: string
  password: string
}

export interface IAuthHookContext {
  session: IUserSession | null
  loading: boolean
  authError: string
  operatorOptions: string[]
  isAuthenticated: boolean
  signIn: (credentials: ISignInCredentials) => Promise<void>
  signOut: () => Promise<void>
  hasRole: (requiredRoles?: string[]) => boolean
  can: (permission: string) => boolean
  getLastOperator: () => string
}

/**
 * Wrapper tipado para o AuthContext legado.
 */
export function useAuth(): IAuthHookContext {
  return useAuthContext() as IAuthHookContext
}
