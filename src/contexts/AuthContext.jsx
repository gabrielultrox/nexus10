import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import {
  getCurrentUser,
  getUserSession,
  loginWithCustomToken,
  userHasRequiredRole,
} from '../services/auth'
import { requestBackend } from '../services/backendApi'
import {
  clearRemoteSession,
  ensureRemoteSession,
  firebaseReady,
} from '../services/firebaseAuthRuntime'
import { buildRolePermissionFlags, getRoleLabel, hasPermission } from '../services/permissions'
import {
  getDefaultUserProfile,
  getOperatorOptions,
  resolveUserProfileByOperator,
} from '../services/userProfiles'
import { isE2eMode } from '../services/e2eRuntime'

const AuthContext = createContext(null)

const AUTH_STORAGE_KEY = 'nexus10.localSession'
const LAST_OPERATOR_STORAGE_KEY = 'nexus10.lastOperator'

const operatorOptions = getOperatorOptions()

function buildLocalSession(profile) {
  return {
    uid: profile.uid,
    email: profile.email ?? null,
    displayName: profile.displayName,
    operatorName: profile.operatorName,
    isAnonymous: false,
    role: profile.role,
    roleLabel: getRoleLabel(profile.role),
    tenantId: profile.tenantId,
    storeIds: profile.storeIds,
    defaultStoreId: profile.defaultStoreId,
    authMode: 'local',
    claims: {},
    permissions: buildRolePermissionFlags(profile.role),
  }
}

function buildRemoteSession(remoteSession, fallbackProfile = null) {
  const profile = fallbackProfile ?? {}
  const operatorName =
    remoteSession.claims?.operatorName ??
    profile.operatorName ??
    remoteSession.displayName ??
    'Operador'

  return {
    ...remoteSession,
    displayName: remoteSession.displayName ?? profile.displayName ?? operatorName,
    operatorName,
    authMode: 'remote',
    roleLabel: getRoleLabel(remoteSession.role),
    permissions: remoteSession.permissions ?? buildRolePermissionFlags(remoteSession.role),
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    async function restoreSession() {
      try {
        const e2eMode = isE2eMode()

        if (typeof window === 'undefined') {
          setSession(null)
          return
        }

        const savedSession = window.localStorage.getItem(AUTH_STORAGE_KEY)
        const parsedSavedSession = savedSession ? JSON.parse(savedSession) : null

        if (e2eMode) {
          setSession(parsedSavedSession)
          return
        }

        if (!firebaseReady) {
          window.localStorage.removeItem(AUTH_STORAGE_KEY)
          setAuthError('Autenticacao remota indisponivel. Configure o Firebase para operar o app.')
          setSession(null)
          return
        }

        const remoteUser = await ensureRemoteSession().catch(() => null)

        if (!remoteUser) {
          window.localStorage.removeItem(AUTH_STORAGE_KEY)
          setSession(null)
          return
        }

        const remoteSession = await getUserSession(remoteUser)
        const fallbackProfile = await resolveUserProfileByOperator(
          remoteSession?.claims?.operatorName ??
            remoteSession?.displayName ??
            parsedSavedSession?.operatorName ??
            '',
        ).catch(() => null)
        const nextSession = buildRemoteSession(remoteSession, fallbackProfile)
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession))
        if (nextSession.operatorName) {
          window.localStorage.setItem(LAST_OPERATOR_STORAGE_KEY, nextSession.operatorName)
        }
        setSession(nextSession)
      } catch (error) {
        console.error('Nao foi possivel restaurar a sessao local.', error)
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(AUTH_STORAGE_KEY)
        }
        setAuthError('Nao foi possivel restaurar a sessao remota.')
        setSession(null)
      } finally {
        setLoading(false)
      }
    }

    restoreSession()
  }, [])

  const value = useMemo(
    () => ({
      session,
      loading,
      authError,
      operatorOptions,
      isAuthenticated: Boolean(session),
      async signIn(credentials) {
        const operatorName = credentials.operatorName?.trim()
        const e2eMode = isE2eMode()

        setAuthError('')

        if (!operatorName) {
          throw new Error('Selecione um operador.')
        }

        if (!firebaseReady && !e2eMode) {
          throw new Error('Autenticacao remota indisponivel. Configure o Firebase deste terminal.')
        }

        let nextSession = null

        if (firebaseReady && !e2eMode) {
          const authResponse = await requestBackend('/auth/session', {
            method: 'POST',
            skipAuth: true,
            body: {
              operator: operatorName,
              pin: credentials.pin,
              storeId: null,
            },
          })
          await loginWithCustomToken(authResponse.customToken)
          const currentUser = getCurrentUser()

          if (!currentUser) {
            throw new Error('Nao foi possivel concluir a autenticacao remota.')
          }

          const remoteSession = await getUserSession(currentUser)
          nextSession = buildRemoteSession(remoteSession, authResponse.profile)
        } else {
          const profile = await resolveUserProfileByOperator(operatorName).catch(() =>
            getDefaultUserProfile(operatorName),
          )
          nextSession = buildLocalSession(profile)
        }

        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession))
        window.localStorage.setItem(LAST_OPERATOR_STORAGE_KEY, operatorName)
        setSession(nextSession)
      },
      async signOut() {
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
        if (firebaseReady && !isE2eMode()) {
          await clearRemoteSession().catch(() => null)
          setSession(null)
          return
        }
        setSession(null)
      },
      hasRole(requiredRoles = []) {
        return userHasRequiredRole(session, requiredRoles)
      },
      can(permission) {
        return hasPermission(session?.role, permission)
      },
      getLastOperator() {
        return window.localStorage.getItem(LAST_OPERATOR_STORAGE_KEY) ?? ''
      },
    }),
    [authError, loading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
