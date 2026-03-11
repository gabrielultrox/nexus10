import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { userHasRequiredRole } from '../services/auth';
import { buildRolePermissionFlags, getRoleLabel, hasPermission } from '../services/permissions';
import {
  getDefaultUserProfile,
  getOperatorOptions,
  refreshSessionProfile,
  resolveUserProfileByOperator,
} from '../services/userProfiles';

const AuthContext = createContext(null);

const AUTH_STORAGE_KEY = 'nexus10.localSession';
const LAST_OPERATOR_STORAGE_KEY = 'nexus10.lastOperator';

const operatorOptions = getOperatorOptions();

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
    claims: {},
    permissions: buildRolePermissionFlags(profile.role),
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    async function restoreSession() {
      try {
        const savedSession = window.localStorage.getItem(AUTH_STORAGE_KEY);

        if (!savedSession) {
          setSession(null);
          return;
        }

        const parsedSession = JSON.parse(savedSession);
        const refreshedProfile = await refreshSessionProfile(parsedSession).catch(() => (
          getDefaultUserProfile(parsedSession.operatorName ?? parsedSession.displayName ?? 'Operador local')
        ));
        const nextSession = buildLocalSession(refreshedProfile);
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
        setSession(nextSession);
      } catch (error) {
        console.error('Nao foi possivel restaurar a sessao local.', error);
        setAuthError('Nao foi possivel restaurar a sessao local.');
        setSession(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading,
      authError,
      operatorOptions,
      isAuthenticated: Boolean(session),
      async signIn(credentials) {
        const operatorName = credentials.operatorName?.trim();

        setAuthError('');

        if (!operatorName) {
          throw new Error('Selecione um operador.');
        }

        if (credentials.password !== '01') {
          throw new Error('Senha incorreta.');
        }

        const profile = await resolveUserProfileByOperator(operatorName)
          .catch(() => getDefaultUserProfile(operatorName));
        const nextSession = buildLocalSession(profile);

        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
        window.localStorage.setItem(LAST_OPERATOR_STORAGE_KEY, operatorName);
        setSession(nextSession);
      },
      async signOut() {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        setSession(null);
      },
      hasRole(requiredRoles = []) {
        return userHasRequiredRole(session, requiredRoles);
      },
      can(permission) {
        return hasPermission(session?.role, permission);
      },
      getLastOperator() {
        return window.localStorage.getItem(LAST_OPERATOR_STORAGE_KEY) ?? '';
      },
    }),
    [authError, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
