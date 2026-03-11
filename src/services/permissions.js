export const roles = {
  admin: 'admin',
  gerente: 'gerente',
  operador: 'operador',
  atendente: 'atendente',
};

export const roleLabels = {
  [roles.admin]: 'Admin',
  [roles.gerente]: 'Gerente',
  [roles.operador]: 'Operador',
  [roles.atendente]: 'Atendente',
};

const roleRank = {
  [roles.admin]: 0,
  [roles.gerente]: 1,
  [roles.operador]: 2,
  [roles.atendente]: 3,
};

const allPermissions = [
  'dashboard:read',
  'operations:read',
  'operations:write',
  'orders:read',
  'orders:write',
  'sales:read',
  'sales:write',
  'catalog:read',
  'catalog:write',
  'customers:read',
  'customers:write',
  'inventory:read',
  'inventory:write',
  'finance:read',
  'finance:write',
  'reports:read',
  'audit:read',
  'settings:write',
  'users:read',
  'users:write',
];

export const rolePermissions = {
  [roles.admin]: allPermissions,
  [roles.gerente]: [
    'dashboard:read',
    'operations:read',
    'operations:write',
    'orders:read',
    'orders:write',
    'sales:read',
    'sales:write',
    'catalog:read',
    'catalog:write',
    'customers:read',
    'customers:write',
    'inventory:read',
    'inventory:write',
    'finance:read',
    'finance:write',
    'reports:read',
  ],
  [roles.operador]: [
    'dashboard:read',
    'operations:read',
    'operations:write',
    'orders:read',
    'orders:write',
    'sales:read',
  ],
  [roles.atendente]: [
    'dashboard:read',
    'orders:read',
    'orders:write',
    'customers:read',
    'customers:write',
  ],
};

export function normalizeRole(rawRole) {
  return Object.values(roles).includes(rawRole) ? rawRole : roles.operador;
}

export function getRoleLabel(role) {
  return roleLabels[normalizeRole(role)];
}

export function hasPermission(role, permission) {
  const resolvedRole = normalizeRole(role);
  const permissions = rolePermissions[resolvedRole] ?? [];
  return permissions.includes(permission);
}

export function buildRolePermissionFlags(role) {
  const resolvedRole = normalizeRole(role);

  return {
    canReadStores: hasPermission(resolvedRole, 'dashboard:read'),
    canWriteStores: hasPermission(resolvedRole, 'operations:write'),
    canWriteOrders: hasPermission(resolvedRole, 'orders:write'),
    canWriteFinance: hasPermission(resolvedRole, 'finance:write'),
    canWriteUsers: hasPermission(resolvedRole, 'users:write'),
  };
}

export function hasRoleAccess(role, requiredRoles = []) {
  if (!requiredRoles.length) {
    return true;
  }

  const resolvedRole = normalizeRole(role);
  const currentRank = roleRank[resolvedRole];

  return requiredRoles.some((requiredRole) => {
    const resolvedRequiredRole = normalizeRole(requiredRole);
    return currentRank <= roleRank[resolvedRequiredRole];
  });
}
