export type UserRole = 'admin' | 'gerente' | 'operador' | 'atendente';

export interface AuthSessionRequestBody {
  pin: string;
  operator: string;
  storeId: string | null;
}

export interface AuthSessionClaims {
  role: UserRole;
  tenantId: string | null;
  storeIds: string[];
  defaultStoreId: string | null;
  operatorName: string;
  displayName: string;
}

export interface LocalOperatorProfile {
  uid: string;
  operatorName: string;
  displayName: string;
  email: string | null;
  role: UserRole;
  tenantId: string | null;
  storeIds: string[];
  defaultStoreId: string | null;
  status: string;
  authMode: string;
}

export interface AuthenticatedUserContext {
  uid: string;
  email: string | null;
  displayName: string | null;
  operatorName: string | null;
  role: UserRole | string;
  tenantId: string | null;
  storeIds: string[];
  defaultStoreId: string | null;
  isAnonymous: boolean;
  claims: Record<string, unknown>;
}

export interface RequestLoggerLike {
  debug?: (payload: unknown, message?: string) => void;
  info: (payload: unknown, message?: string) => void;
  warn: (payload: unknown, message?: string) => void;
  error: (payload: unknown, message?: string) => void;
}

export interface AuthSessionResponseBody {
  data: {
    customToken: string;
    profile: LocalOperatorProfile;
  };
}

export interface ErrorResponseBody {
  error: string;
}
