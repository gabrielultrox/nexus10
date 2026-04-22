import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { userHasRequiredRole } from '../services/auth'
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
const DEFAULT_OPERATOR_NAME = operatorOptions[0] ?? 'Gabriel'

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

function resolvePreferredOperatorName(savedSession = null) {
  if (typeof window === 'undefined') {
    return savedSession?.operatorName ?? DEFAULT_OPERATOR_NAME
  }

  return (
    savedSession?.operatorName ??
    window.localStorage.getItem(LAST_OPERATOR_STORAGE_KEY) ??
    DEFAULT_OPERATOR_NAME
  )
}

async function buildAutomaticSession(operatorName = '') {
  const resolvedOperatorName = operatorName?.trim() || DEFAULT_OPERATOR_NAME
  const profile = await resolveUserProfileByOperator(resolvedOperatorName).catch(() =>
    getDefaultUserProfile(resolvedOperatorName),
  )

  return buildLocalSession(profile)
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    async function restoreSession() {
      try {
        if (typeof window === 'undefined') {
          const nextSession = await buildAutomaticSession(DEFAULT_OPERATOR_NAME)
          setSession(nextSession)
          return
        }

        const savedSession = window.localStorage.getItem(AUTH_STORAGE_KEY)
        const parsedSavedSession = savedSession ? JSON.parse(savedSession) : null
        const nextSession = isE2eMode()
          ? parsedSavedSession
          : await buildAutomaticSession(resolvePreferredOperatorName(parsedSavedSession))

        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession))
        if (nextSession.operatorName) {
          window.localStorage.setItem(LAST_OPERATOR_STORAGE_KEY, nextSession.operatorName)
        }
        setAuthError('')
        setSession(nextSession)
      } catch (error) {
        console.error('Nao foi possivel restaurar a sessao automatica.', error)
        if (typeof window !== 'undefined') {
          const fallbackSession = buildLocalSession(getDefaultUserProfile(DEFAULT_OPERATOR_NAME))
          window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(fallbackSession))
          window.localStorage.setItem(LAST_OPERATOR_STORAGE_KEY, fallbackSession.operatorName)
          setSession(fallbackSession)
        }
        setAuthError('')
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

        setAuthError('')

        if (!operatorName) {
          throw new Error('Selecione um operador.')
        }

        const nextSession = await buildAutomaticSession(operatorName)

        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession))
        window.localStorage.setItem(LAST_OPERATOR_STORAGE_KEY, operatorName)
        setSession(nextSession)
      },
      async signOut() {
        const nextSession = await buildAutomaticSession(resolvePreferredOperatorName())
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession))
        window.localStorage.setItem(LAST_OPERATOR_STORAGE_KEY, nextSession.operatorName)
        setSession(nextSession)
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
