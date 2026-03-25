import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  getCurrentUser,
  getUserSession,
  loginWithCustomToken,
  userHasRequiredRole,
} from '../services/auth';
import { requestBackend } from '../services/backendApi';
import { clearRemoteSession, ensureRemoteSession, firebaseReady } from '../services/firebase';
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

function getTemporaryOperatorName() {
  if (typeof window === 'undefined') {
    return operatorOptions[0] ?? 'Gabriel';
  }

  return window.localStorage.getItem(LAST_OPERATOR_STORAGE_KEY) ?? operatorOptions[0] ?? 'Gabriel';
}

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

function buildRemoteSession(remoteSession, fallbackProfile = null) {
  const profile = fallbackProfile ?? {};
  const operatorName = remoteSession.claims?.operatorName
    ?? profile.operatorName
    ?? remoteSession.displayName
    ?? 'Operador';

  return {
    ...remoteSession,
    displayName: remoteSession.displayName ?? profile.displayName ?? operatorName,
    operatorName,
    roleLabel: getRoleLabel(remoteSession.role),
    permissions: remoteSession.permissions ?? buildRolePermissionFlags(remoteSession.role),
  };
}

async function buildTemporarySession() {
  const operatorName = getTemporaryOperatorName();
  const profile = await resolveUserProfileByOperator(operatorName)
    .catch(() => getDefaultUserProfile(operatorName));

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LAST_OPERATOR_STORAGE_KEY, operatorName);
  }

  return buildLocalSession(profile);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    async function restoreSession() {
      try {
        if (typeof window === 'undefined') {
          setSession(await buildTemporarySession());
          return;
        }

        const savedSession = window.localStorage.getItem(AUTH_STORAGE_KEY);
        const parsedSavedSession = savedSession ? JSON.parse(savedSession) : null;

        if (firebaseReady) {
          const remoteUser = await ensureRemoteSession().catch(() => null);

          if (remoteUser) {
            const remoteSession = await getUserSession(remoteUser);
            const fallbackProfile = await resolveUserProfileByOperator(
              remoteSession?.claims?.operatorName
              ?? remoteSession?.displayName
              ?? parsedSavedSession?.operatorName
              ?? '',
            ).catch(() => null);
            const nextSession = buildRemoteSession(remoteSession, fallbackProfile);
            window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
            if (nextSession.operatorName) {
              window.localStorage.setItem(LAST_OPERATOR_STORAGE_KEY, nextSession.operatorName);
            }
            setSession(nextSession);
            return;
          }

          window.localStorage.removeItem(AUTH_STORAGE_KEY);
          setSession(null);
          return;
        }

        if (!savedSession) {
          const nextSession = await buildTemporarySession();
          window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
          setSession(nextSession);
          return;
        }

        const refreshedProfile = await refreshSessionProfile(parsedSavedSession).catch(() => (
          getDefaultUserProfile(parsedSavedSession.operatorName ?? parsedSavedSession.displayName ?? 'Operador local')
        ));
        const nextSession = buildLocalSession(refreshedProfile);
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
        setSession(nextSession);
      } catch (error) {
        console.error('Nao foi possivel restaurar a sessao local.', error);
        const nextSession = await buildTemporarySession();
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
        setAuthError('');
        setSession(nextSession);
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

        let nextSession = null;

        if (firebaseReady) {
          const authResponse = await requestBackend('/auth/session', {
            method: 'POST',
            skipAuth: true,
            body: {
              operatorName,
              password: credentials.password,
            },
          });
          await loginWithCustomToken(authResponse.customToken);
          const currentUser = getCurrentUser();

          if (!currentUser) {
            throw new Error('Nao foi possivel concluir a autenticacao remota.');
          }

          const remoteSession = await getUserSession(currentUser);
          nextSession = buildRemoteSession(remoteSession, authResponse.profile);
        } else {
          if (credentials.password !== '01') {
            throw new Error('Senha incorreta.');
          }

          const profile = await resolveUserProfileByOperator(operatorName)
            .catch(() => getDefaultUserProfile(operatorName));
          nextSession = buildLocalSession(profile);
        }

        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
        window.localStorage.setItem(LAST_OPERATOR_STORAGE_KEY, operatorName);
        setSession(nextSession);
      },
      async signOut() {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        if (firebaseReady) {
          await clearRemoteSession().catch(() => null);
          setSession(null);
          return;
        }
        const nextSession = await buildTemporarySession();
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
        setSession(nextSession);
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
