import { recordAuditEvent as recordCentralAuditEvent } from '../../services/auditService.js'

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
    return null
  }

  return recordCentralAuditEvent({
    storeId,
    tenantId,
    actor,
    action,
    module: entityType,
    entityType,
    entityId,
    description,
    metadata,
  })
}
