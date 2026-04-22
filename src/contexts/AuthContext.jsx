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

async function buildLocalOperatorSession(operatorName = '') {
  const resolvedOperatorName = operatorName?.trim()

  if (!resolvedOperatorName) {
    throw new Error('Selecione um operador.')
  }

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
        if (typeof window === 'undefined' || !isE2eMode()) {
          setSession(null)
          setAuthError('')
          return
        }

        const savedSession = window.localStorage.getItem(AUTH_STORAGE_KEY)
        const parsedSavedSession = savedSession ? JSON.parse(savedSession) : null
        setAuthError('')
        setSession(parsedSavedSession)
      } catch (error) {
        console.error('Nao foi possivel restaurar a sessao.', error)
        setAuthError('')
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

        setAuthError('')

        if (!operatorName) {
          throw new Error('Selecione um operador.')
        }

        const nextSession = await buildLocalOperatorSession(operatorName)

        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession))
        window.localStorage.setItem(LAST_OPERATOR_STORAGE_KEY, operatorName)
        setSession(nextSession)
      },
      async signOut() {
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
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
