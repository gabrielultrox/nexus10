import { loadLocalRecords, saveLocalRecords } from './localAccess'
import { getManualModuleConfig } from './manualModuleConfig'

export const AUDIT_LOG_STORAGE_KEY = 'nexus-local-audit-log'
const DEFAULT_OPERATIONAL_RESET_HOUR = 3

function createAuditId() {
  return `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function buildCalendarDayKey(value) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function buildOperationalDayKey(value, resetHour = DEFAULT_OPERATIONAL_RESET_HOUR) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  if (date.getHours() < resetHour) {
    date.setDate(date.getDate() - 1)
  }

  return buildCalendarDayKey(date)
}

function resolveAuditResetHour(modulePath) {
  if (modulePath === 'cash') {
    return DEFAULT_OPERATIONAL_RESET_HOUR
  }

  return getManualModuleConfig(modulePath)?.dailyResetHour ?? null
}

function normalizeAuditEvent(event) {
  const timestamp = event?.timestamp ?? new Date().toISOString()
  const resetHour = resolveAuditResetHour(event?.modulePath)
  const operationalDay =
    typeof event?.operationalDay === 'string' && event.operationalDay.trim()
      ? event.operationalDay.trim()
      : resetHour != null
        ? buildOperationalDayKey(timestamp, resetHour)
        : buildCalendarDayKey(timestamp)

  return {
    ...event,
    timestamp,
    operationalDay,
  }
}

export function loadAuditEvents() {
  const storedEvents = loadLocalRecords(AUDIT_LOG_STORAGE_KEY, [])
  const normalizedEvents = storedEvents.map(normalizeAuditEvent)
  const requiresRewrite = normalizedEvents.some(
    (event, index) =>
      event.timestamp !== storedEvents[index]?.timestamp ||
      event.operationalDay !== storedEvents[index]?.operationalDay,
  )

  if (requiresRewrite) {
    saveLocalRecords(AUDIT_LOG_STORAGE_KEY, normalizedEvents)
  }

  return normalizedEvents
}

export function saveAuditEvents(events) {
  saveLocalRecords(AUDIT_LOG_STORAGE_KEY, events.map(normalizeAuditEvent))
}

export function appendAuditEvent(event) {
  const currentEvents = loadAuditEvents()
  const nextEvent = normalizeAuditEvent({
    id: createAuditId(),
    timestamp: new Date().toISOString(),
    ...event,
  })
  const nextEvents = [nextEvent, ...currentEvents].slice(0, 300)

  saveAuditEvents(nextEvents)
}
