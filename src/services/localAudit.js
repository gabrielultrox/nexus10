import { loadLocalRecords, saveLocalRecords } from './localRecords';

export const AUDIT_LOG_STORAGE_KEY = 'nexus-local-audit-log';

function createAuditId() {
  return `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function loadAuditEvents() {
  return loadLocalRecords(AUDIT_LOG_STORAGE_KEY, []);
}

export function saveAuditEvents(events) {
  saveLocalRecords(AUDIT_LOG_STORAGE_KEY, events);
}

export function appendAuditEvent(event) {
  const currentEvents = loadAuditEvents();
  const nextEvents = [
    {
      id: createAuditId(),
      timestamp: new Date().toISOString(),
      ...event,
    },
    ...currentEvents,
  ].slice(0, 300);

  saveAuditEvents(nextEvents);
}
