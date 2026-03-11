import { createAuditRepository } from './auditRepository.js';

const repository = createAuditRepository();

function buildActor(actor) {
  return {
    id: actor?.id ?? actor?.uid ?? null,
    name: actor?.name ?? actor?.operatorName ?? actor?.displayName ?? 'Sistema',
    role: actor?.role ?? 'system',
  };
}

export async function recordAuditEvent({
  storeId,
  tenantId = null,
  actor,
  action,
  entityType,
  entityId,
  description,
  metadata = null,
}) {
  if (!storeId || !action || !entityType || !entityId || !description) {
    return null;
  }

  return repository.createAuditLog({
    storeId,
    payload: {
      storeId,
      tenantId,
      actor: buildActor(actor),
      action,
      entityType,
      entityId,
      description,
      metadata,
      createdAt: new Date(),
    },
  });
}
