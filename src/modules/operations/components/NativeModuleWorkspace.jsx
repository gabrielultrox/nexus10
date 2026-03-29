import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import MetricCard from '../../../components/common/MetricCard'
import PageIntro from '../../../components/common/PageIntro'
import { useConfirm } from '../../../hooks/useConfirm'
import { useToast } from '../../../hooks/useToast'
import { useAuth } from '../../../contexts/AuthContext'
import { useStore } from '../../../contexts/StoreContext'
import { MANUAL_COURIER_STORAGE_KEY, subscribeToCouriers } from '../../../services/courierService'
import { canUseRemoteSync, firebaseReady } from '../../../services/firebase'
import { appendAuditEvent, loadAuditEvents } from '../../../services/localAudit'
import {
  loadLocalRecords,
  loadResettableLocalRecords,
  resetLocalRecordsNow,
  saveLocalRecords,
  saveResettableLocalRecords,
} from '../../../services/localAccess'
import { storeUserOptions } from '../../../services/localUsers'
import { getManualModuleConfig } from '../../../services/manualModuleConfig'
import {
  clearManualModuleRecords,
  deleteManualModuleRecord,
  saveManualModuleRecord,
  subscribeToManualModuleRecords,
} from '../../../services/manualModuleService'
import {
  enqueueManualModuleSyncOperation,
  flushManualModuleSyncQueue,
  getManualModuleLocalMode,
  getManualModulePendingCount,
  getManualModuleSyncHistory,
  setManualModuleLocalMode,
} from '../../../services/manualModuleSyncQueue'
import { getNativeModuleContent } from '../../../services/nativeModuleData'
import { courierSeedRecords, machineSeedRecords } from '../../../services/operationsSeedData'
import { printOperationalReport } from '../../../services/operationsPrint'
import {
  playError,
  playNotification,
  playOperationalSuccess,
  playOperationalWarning,
} from '../../../services/soundManager'
import NativeModuleExportCanvases from './NativeModuleExportCanvases'
import NativeModuleFormCard from './NativeModuleFormCard'
import NativeModulePanels from './NativeModulePanels'
import NativeModuleRecordsSection from './NativeModuleRecordsSection'
import NativeModuleStatusBar from './NativeModuleStatusBar'

const legacySeedIdPattern = /^(schedule|machine|change|discount|occurrence|map)-\d+$/
const DELIVERY_READING_LAST_COURIER_KEY = 'leitura_last_entregador'

let htmlToImageModulePromise

async function loadToPng() {
  if (!htmlToImageModulePromise) {
    htmlToImageModulePromise = import('html-to-image')
  }

  const { toPng } = await htmlToImageModulePromise
  return toPng
}

function isPlaceholderOption(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

  return (
    !normalized ||
    normalized.includes('cadastre') ||
    normalized.includes('selecione') ||
    normalized.includes('primeiro')
  )
}

function hasValidOptions(options = []) {
  return options.some((option) => !isPlaceholderOption(option))
}

function buildInitialFormState(config) {
  if (!config) {
    return {}
  }

  return config.fields.reduce((accumulator, field) => {
    const defaultValue =
      typeof field.defaultValue === 'function' ? field.defaultValue() : field.defaultValue

    accumulator[field.name] =
      defaultValue ??
      (field.type === 'select' ? field.options[0] : field.type === 'checkbox' ? false : '')
    return accumulator
  }, {})
}

function buildDeliveryReadingFormState(config, preferredCourier = '') {
  const baseState = buildInitialFormState(config)

  return {
    ...baseState,
    courier: preferredCourier || baseState.courier || '',
    deliveryCode: '',
    turbo: false,
    closed: false,
  }
}

function sanitizeManualRecords(records) {
  return records.filter((record) => !legacySeedIdPattern.test(record.id ?? ''))
}

function dedupeRecordsById(records) {
  const seenIds = new Set()

  return records.filter((record) => {
    const recordId = record?.id

    if (!recordId) {
      return true
    }

    if (seenIds.has(recordId)) {
      return false
    }

    seenIds.add(recordId)
    return true
  })
}

function normalizeManualRecords(records) {
  return dedupeRecordsById(sanitizeManualRecords(records))
}

function buildRouteRecords(routePath, manager) {
  if (!manager) {
    return []
  }

  if (routePath === 'machine-history') {
    return []
  }

  if (manager.dailyResetHour != null) {
    return normalizeManualRecords(
      loadResettableLocalRecords(
        manager.storageKey,
        manager.initialRecords,
        manager.dailyResetHour,
      ),
    )
  }

  return normalizeManualRecords(loadLocalRecords(manager.storageKey, manager.initialRecords))
}

function buildAuditContext(session) {
  return {
    updatedAt: new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date()),
    updatedBy: session?.operatorName ?? session?.displayName ?? 'Operador local',
  }
}

function buildResolvedFields(config, routePath, dynamicOptions) {
  if (!config) {
    return []
  }

  const courierOptions = dynamicOptions.courierOptions
  const machineOptions = dynamicOptions.machineOptions
  const storeMemberOptions = dynamicOptions.storeMemberOptions
  const destinationOptions =
    courierOptions.length > 0 ? courierOptions : ['Cadastre um entregador primeiro']
  const scheduleCourierOptions =
    courierOptions.length > 0 ? courierOptions : ['Cadastre um entregador primeiro']

  return config.fields.map((field) => {
    if (routePath === 'change' && field.name === 'origin') {
      return {
        ...field,
        options: storeUserOptions,
      }
    }

    if (routePath === 'change' && field.name === 'destination') {
      return {
        ...field,
        options: destinationOptions,
      }
    }

    if (routePath === 'schedule' && field.name === 'courier') {
      return {
        ...field,
        options: scheduleCourierOptions,
      }
    }

    if (routePath === 'schedule' && field.name === 'machine') {
      return {
        ...field,
        options:
          machineOptions.length > 0 ? ['Sem maquininha', ...machineOptions] : ['Sem maquininha'],
      }
    }

    if (routePath === 'delivery-reading' && field.name === 'courier') {
      return {
        ...field,
        options: courierOptions.length > 0 ? courierOptions : ['Cadastre um entregador primeiro'],
      }
    }

    if (routePath === 'machines' && field.name === 'holder') {
      return {
        ...field,
        options:
          courierOptions.length > 0
            ? ['Nenhum', ...courierOptions]
            : ['Nenhum', 'Cadastre um entregador primeiro'],
      }
    }

    if (routePath === 'occurrences' && field.name === 'owner') {
      return {
        ...field,
        options: storeMemberOptions.length > 0 ? storeMemberOptions : ['Operador local'],
      }
    }

    if (routePath === 'advances' && field.name === 'recipient') {
      return {
        ...field,
        options: storeMemberOptions.length > 0 ? storeMemberOptions : ['Operador local'],
      }
    }

    return field
  })
}

function renderPanel(panel) {
  if (panel.items) {
    return (
      <div className="native-module__list">
        {panel.items.map((item) => (
          <div key={`${panel.title}-${item.label}`} className="native-module__list-item">
            <div>
              <p className="native-module__list-label">{item.label}</p>
              <strong className="native-module__list-value">{item.value}</strong>
            </div>
            <span className={`ui-badge ui-badge--${item.tone ?? 'info'}`}>
              {item.tone ?? 'info'}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="native-module__timeline">
      {panel.timeline.map((entry) => (
        <article key={`${panel.title}-${entry.title}`} className="native-module__timeline-item">
          <span className="native-module__timeline-dot" />
          <div>
            <p className="native-module__timeline-title">{entry.title}</p>
            <p className="native-module__timeline-meta">{entry.meta}</p>
          </div>
        </article>
      ))}
    </div>
  )
}

function formatChecklistDate() {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(new Date())
    .replace(/\./g, '')
    .toUpperCase()
}

function formatCurrencyValue(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function parseCurrencyValue(value) {
  const normalized = String(value ?? '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function isCompletedChangeRecord(record) {
  const normalized = String(record?.status ?? '')
    .trim()
    .toLowerCase()

  return (
    normalized.includes('conclu') || normalized.includes('retorn') || normalized.includes('recebid')
  )
}

function resolveDisplayText(value, fallback = 'Nao informado') {
  if (typeof value === 'string') {
    const trimmedValue = value.trim()
    return trimmedValue.length > 0 ? trimmedValue : fallback
  }

  if (typeof value === 'number') {
    return String(value)
  }

  if (Array.isArray(value)) {
    const joinedValue = value
      .map((entry) => resolveDisplayText(entry, ''))
      .filter(Boolean)
      .join(' / ')

    return joinedValue || fallback
  }

  if (value && typeof value === 'object') {
    const candidateKeys = ['operatorName', 'displayName', 'name', 'label', 'value', 'title', 'text']

    for (const key of candidateKeys) {
      const resolvedValue = resolveDisplayText(value[key], '')

      if (resolvedValue) {
        return resolvedValue
      }
    }
  }

  return fallback
}

function formatAuditText(record, fallback = 'Sem atualizacao') {
  const actorLabel = resolveDisplayText(record?.updatedBy, '')
  const timeLabel = resolveDisplayText(record?.updatedAt, '')

  if (actorLabel && timeLabel) {
    return `${actorLabel} - ${timeLabel}`
  }

  return actorLabel || timeLabel || fallback
}

function resolveAuditEventDayKey(event) {
  if (typeof event?.operationalDay === 'string' && event.operationalDay.trim()) {
    return event.operationalDay.trim()
  }

  return String(event?.timestamp ?? '').slice(0, 10)
}

function buildOperationsAuditSummary(routePath, record) {
  if (!record) {
    return null
  }

  if (routePath === 'change') {
    return {
      target: record.destination ?? 'entregador',
      details: `Troco de ${record.value ?? 'R$ 0,00'} para ${record.destination ?? 'entregador'}`,
      value: record.value ?? '',
      courier: record.destination ?? '',
    }
  }

  if (routePath === 'advances') {
    return {
      target: record.recipient ?? 'entregador',
      details: `Vale de ${record.value ?? 'R$ 0,00'} para ${record.recipient ?? 'entregador'}`,
      value: record.value ?? '',
      courier: record.recipient ?? '',
    }
  }

  return null
}

function getActiveScheduleCouriers() {
  return Array.from(
    new Set(
      sanitizeManualRecords(loadResettableLocalRecords('nexus-module-schedule', [], 3))
        .map((record) => record?.courier?.trim())
        .filter(Boolean),
    ),
  )
}

function getPreferredDeliveryCourier(options) {
  const validOptions = options.filter((option) => !isPlaceholderOption(option))

  if (validOptions.length === 0) {
    return ''
  }

  const activeScheduleCouriers = getActiveScheduleCouriers()

  if (activeScheduleCouriers.length === 1 && validOptions.includes(activeScheduleCouriers[0])) {
    return activeScheduleCouriers[0]
  }

  const lastCourier = localStorage.getItem(DELIVERY_READING_LAST_COURIER_KEY) ?? ''

  if (lastCourier && validOptions.includes(lastCourier)) {
    return lastCourier
  }

  return validOptions[0] ?? ''
}

function buildMachineChecklistRecords(machineRecords, checklist = [], currentRecords = []) {
  return machineRecords.map((machine) => {
    const savedState = checklist.find((item) => item.id === machine.id)
    const currentState = currentRecords.find((item) => item.id === machine.id)

    return {
      id: machine.id,
      device: machine.device,
      holder: machine.holder,
      model: machine.model,
      status: savedState?.status ?? currentState?.status ?? 'Ausente',
      machineStatus: machine.status ?? 'Ativa',
      updatedAt: savedState?.updatedAt ?? currentState?.updatedAt ?? '',
      updatedBy: savedState?.updatedBy ?? currentState?.updatedBy ?? '',
    }
  })
}

function loadMachineChecklistState() {
  return loadResettableLocalRecords('nexus-module-machine-history', [], 3)
}

function shouldUseLocalFallback(error) {
  return Boolean(error)
}

function NativeModuleWorkspace({ route }) {
  const [searchParams] = useSearchParams()
  const { session } = useAuth()
  const { currentStoreId, tenantId } = useStore()
  const toast = useToast()
  const confirm = useConfirm()
  const content = getNativeModuleContent(route)
  const manager = getManualModuleConfig(route.path)
  const [isOnline, setIsOnline] = useState(() => window.navigator.onLine)
  const [localOnlyMode, setLocalOnlyModeState] = useState(() => getManualModuleLocalMode())
  const [availableCourierNames, setAvailableCourierNames] = useState(() =>
    loadLocalRecords(MANUAL_COURIER_STORAGE_KEY, courierSeedRecords)
      .map((courier) => courier?.name?.trim())
      .filter(Boolean),
  )
  const [availableMachineRecords, setAvailableMachineRecords] = useState(() =>
    loadLocalRecords('nexus-module-machines', machineSeedRecords),
  )
  const [availableMachineOptions, setAvailableMachineOptions] = useState(() =>
    loadLocalRecords('nexus-module-machines', machineSeedRecords)
      .map((machine) => machine?.device?.trim())
      .filter(Boolean),
  )
  const storeMemberOptions = useMemo(
    () => Array.from(new Set([...storeUserOptions, ...availableCourierNames])),
    [availableCourierNames],
  )
  const syncModulePaths = useMemo(
    () => (route.path === 'machines' ? ['machines', 'machine-history'] : [route.path]),
    [route.path],
  )
  const canSyncModuleRecords = Boolean(
    firebaseReady && currentStoreId && isOnline && !localOnlyMode,
  )
  const remoteSyncReady = Boolean(
    currentStoreId && isOnline && !localOnlyMode && canUseRemoteSync(),
  )
  const resolvedFields = useMemo(
    () =>
      buildResolvedFields(manager, route.path, {
        courierOptions: availableCourierNames,
        machineOptions: availableMachineOptions,
        storeMemberOptions,
      }),
    [availableCourierNames, availableMachineOptions, manager, route.path, storeMemberOptions],
  )
  const managerWithResolvedFields = useMemo(
    () => (manager ? { ...manager, fields: resolvedFields } : null),
    [manager, resolvedFields],
  )
  const [formValues, setFormValues] = useState(() =>
    buildInitialFormState(managerWithResolvedFields),
  )
  const [records, setRecords] = useState(() =>
    manager ? buildRouteRecords(route.path, manager) : [],
  )
  const [machineChecklistRecords, setMachineChecklistRecords] = useState(() =>
    route.path === 'machines'
      ? buildMachineChecklistRecords(
          buildRouteRecords('machines', manager),
          loadMachineChecklistState(),
        )
      : [],
  )
  const [machineChecklistState, setMachineChecklistState] = useState(() =>
    loadMachineChecklistState(),
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [errorMessage, setErrorMessage] = useState('')
  const [scheduleMachineDrafts, setScheduleMachineDrafts] = useState({})
  const [editableRecordDrafts, setEditableRecordDrafts] = useState({})
  const [highlightedScheduleRecordId, setHighlightedScheduleRecordId] = useState('')
  const [recentlyClosedRecordId, setRecentlyClosedRecordId] = useState(null)
  const [freshRecordId, setFreshRecordId] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [focusFieldKey, setFocusFieldKey] = useState(0)
  const [invalidFieldName, setInvalidFieldName] = useState('')
  const [pendingSyncCount, setPendingSyncCount] = useState(() =>
    getManualModulePendingCount(syncModulePaths),
  )
  const [, setSyncHistory] = useState(() => getManualModuleSyncHistory(syncModulePaths))
  const [, setSyncActivityLabel] = useState(
    remoteSyncReady ? 'Tempo real ativo' : 'Contingencia local pronta',
  )
  const requestedRecordId = searchParams.get('recordId') ?? ''
  const scheduleImageRef = useRef(null)
  const scheduleMachinesImageRef = useRef(null)
  const machineChecklistImageRef = useRef(null)
  const changeDeliveredImageRef = useRef(null)
  const deliveryReadingClosedImageRef = useRef(null)
  const advancesPaidImageRef = useRef(null)
  const invalidFieldTimeoutRef = useRef(null)

  useEffect(() => {
    setPendingSyncCount(getManualModulePendingCount(syncModulePaths))
    setSyncHistory(getManualModuleSyncHistory(syncModulePaths))
  }, [syncModulePaths])

  useEffect(() => {
    if (localOnlyMode) {
      setSyncActivityLabel('Modo somente local ativo')
      return
    }

    if (!isOnline) {
      setSyncActivityLabel('Sem rede, salvando localmente')
      return
    }

    setSyncActivityLabel(remoteSyncReady ? 'Tempo real ativo' : 'Contingencia local pronta')
  }, [isOnline, localOnlyMode, remoteSyncReady, route.path])

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
    }

    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(
    () =>
      subscribeToCouriers(
        currentStoreId,
        (couriers) => {
          const nextCourierNames = couriers.map((courier) => courier?.name?.trim()).filter(Boolean)

          setAvailableCourierNames(nextCourierNames)
        },
        undefined,
      ),
    [currentStoreId],
  )

  useEffect(
    () =>
      subscribeToManualModuleRecords({
        storeId: currentStoreId,
        modulePath: 'machines',
        storageKey: 'nexus-module-machines',
        initialRecords: machineSeedRecords,
        onData: (machineRecords) => {
          setAvailableMachineRecords(machineRecords)
          const nextMachineOptions = Array.from(
            new Set(machineRecords.map((machine) => machine?.device?.trim()).filter(Boolean)),
          )

          setAvailableMachineOptions(nextMachineOptions)
        },
      }),
    [currentStoreId],
  )

  useEffect(
    () =>
      subscribeToManualModuleRecords({
        storeId: currentStoreId,
        modulePath: 'machine-history',
        storageKey: 'nexus-module-machine-history',
        initialRecords: [],
        dailyResetHour: 3,
        onData: (checklistRecords) => {
          setMachineChecklistState(checklistRecords)
        },
      }),
    [currentStoreId],
  )

  useEffect(() => {
    const refreshChecklistState = () => {
      setMachineChecklistState(loadMachineChecklistState())
    }

    refreshChecklistState()
    const intervalId = window.setInterval(refreshChecklistState, 60_000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!managerWithResolvedFields) {
      setFormValues({})
      setRecords([])
      return
    }

    if (route.path === 'delivery-reading') {
      const courierField = managerWithResolvedFields.fields.find(
        (field) => field.name === 'courier',
      )
      const preferredCourier = getPreferredDeliveryCourier(courierField?.options ?? [])
      setFormValues(buildDeliveryReadingFormState(managerWithResolvedFields, preferredCourier))
    } else {
      setFormValues(buildInitialFormState(managerWithResolvedFields))
    }
    setSearchTerm('')
    setStatusFilter('all')
    setErrorMessage('')
    setScheduleMachineDrafts({})
    setEditableRecordDrafts({})
    setHighlightedScheduleRecordId('')
    setRecentlyClosedRecordId(null)
    setFreshRecordId(null)
    setInvalidFieldName('')
  }, [manager, managerWithResolvedFields, route.path])

  useEffect(
    () => () => {
      if (invalidFieldTimeoutRef.current) {
        window.clearTimeout(invalidFieldTimeoutRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    if (!manager) {
      setRecords([])
      return () => {}
    }

    return subscribeToManualModuleRecords({
      storeId: currentStoreId,
      modulePath: route.path,
      storageKey: manager.storageKey,
      initialRecords: manager.initialRecords,
      dailyResetHour: manager.dailyResetHour ?? null,
      onData: (nextRecords) => {
        setRecords(normalizeManualRecords(nextRecords))
        setErrorMessage('')
      },
      onError: () => {
        setErrorMessage(
          'Nao foi possivel sincronizar os registros deste modulo com a base compartilhada.',
        )
      },
    })
  }, [currentStoreId, manager, route.path])

  useEffect(() => {
    if (manager) {
      if (route.path === 'machines') {
        saveLocalRecords(manager.storageKey, records)
        return
      }

      if (manager.dailyResetHour != null) {
        saveResettableLocalRecords(manager.storageKey, records, manager.dailyResetHour)
        return
      }

      saveLocalRecords(manager.storageKey, records)
    }
  }, [manager, records, route.path])

  useEffect(() => {
    if (route.path !== 'machines') {
      return
    }

    setMachineChecklistRecords((current) =>
      buildMachineChecklistRecords(records, machineChecklistState, current),
    )
  }, [machineChecklistState, records, route.path])

  useEffect(() => {
    if (route.path !== 'machines') {
      return
    }

    saveResettableLocalRecords('nexus-module-machine-history', machineChecklistRecords, 3)
  }, [machineChecklistRecords, route.path])

  useEffect(() => {
    if (manager?.dailyResetHour == null) {
      return
    }

    const refreshRecords = () => {
      setRecords(buildRouteRecords(route.path, manager))
    }

    window.addEventListener('focus', refreshRecords)
    return () => window.removeEventListener('focus', refreshRecords)
  }, [manager, route.path])

  useEffect(() => {
    let cancelled = false

    async function refreshSyncState() {
      if (currentStoreId && isOnline && !localOnlyMode && canUseRemoteSync()) {
        const result = await flushManualModuleSyncQueue({
          storeId: currentStoreId,
          tenantId,
          modulePaths: syncModulePaths,
        })

        if (cancelled) {
          return
        }

        setPendingSyncCount(result.pendingCount)
        setSyncHistory(getManualModuleSyncHistory(syncModulePaths))

        if (result.flushedCount > 0) {
          setSyncActivityLabel(`${result.flushedCount} pendencias reenviadas`)
        }
      } else if (!cancelled) {
        setPendingSyncCount(getManualModulePendingCount(syncModulePaths))
        setSyncHistory(getManualModuleSyncHistory(syncModulePaths))
      }
    }

    refreshSyncState()
    window.addEventListener('online', refreshSyncState)
    window.addEventListener('focus', refreshSyncState)

    return () => {
      cancelled = true
      window.removeEventListener('online', refreshSyncState)
      window.removeEventListener('focus', refreshSyncState)
    }
  }, [currentStoreId, isOnline, localOnlyMode, syncModulePaths, tenantId])

  useEffect(() => {
    if (!recentlyClosedRecordId) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setRecentlyClosedRecordId(null)
    }, 1400)

    return () => window.clearTimeout(timeoutId)
  }, [recentlyClosedRecordId])

  useEffect(() => {
    if (!freshRecordId) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setFreshRecordId(null)
    }, 900)

    return () => window.clearTimeout(timeoutId)
  }, [freshRecordId])

  useEffect(() => {
    if (!requestedRecordId) {
      return
    }

    if (route.path === 'schedule') {
      setHighlightedScheduleRecordId(requestedRecordId)
      return
    }

    setFreshRecordId(requestedRecordId)
  }, [requestedRecordId, route.path])

  useEffect(() => {
    if (!invalidFieldName) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setInvalidFieldName('')
    }, 2000)

    return () => window.clearTimeout(timeoutId)
  }, [invalidFieldName])

  const metrics = useMemo(() => {
    if (route.path === 'machines') {
      const presentCount = machineChecklistRecords.filter(
        (record) => record.status === 'Presente',
      ).length
      const absentCount = machineChecklistRecords.filter(
        (record) => record.status !== 'Presente',
      ).length
      const problemCount = machineChecklistRecords.filter((record) =>
        ['Manutencao', 'Carga'].includes(record.machineStatus),
      ).length

      return [
        {
          label: 'Total maquininhas',
          value: String(machineChecklistRecords.length).padStart(2, '0'),
          meta: 'base cadastrada para o turno',
        },
        {
          label: 'Presentes hoje',
          value: String(presentCount).padStart(2, '0'),
          meta: 'unidades confirmadas no checklist',
          badgeText: 'ok',
          badgeClass: 'ui-badge--success',
        },
        {
          label: 'Ausentes',
          value: String(absentCount).padStart(2, '0'),
          meta: 'ainda nao conferidas no dia',
          badgeText: 'fila',
          badgeClass: 'ui-badge--danger',
        },
        {
          label: 'Com problema',
          value: String(problemCount).padStart(2, '0'),
          meta: 'maquininhas em carga ou manutencao',
          badgeText: 'alerta',
          badgeClass: 'ui-badge--special',
        },
      ]
    }

    if (route.path === 'machine-history') {
      const historyEvents = loadAuditEvents().filter(
        (event) =>
          event.modulePath === 'machines' && event.action.toLowerCase().includes('checklist'),
      )
      const uniqueDays = new Set(historyEvents.map((event) => event.timestamp.slice(0, 10)))
      const uniqueDevices = new Set(historyEvents.map((event) => event.target))

      return [
        {
          label: 'Dias com registro',
          value: String(uniqueDays.size).padStart(2, '0'),
          meta: 'datas com checklist registrado',
          badgeText: 'historico',
          badgeClass: 'ui-badge--info',
        },
        {
          label: 'Marcacoes',
          value: String(historyEvents.length).padStart(2, '0'),
          meta: 'eventos de presenca salvos',
          badgeText: 'log',
          badgeClass: 'ui-badge--success',
        },
        {
          label: 'Maquininhas tocadas',
          value: String(uniqueDevices.size).padStart(2, '0'),
          meta: 'unidades que apareceram no historico',
          badgeText: 'base',
          badgeClass: 'ui-badge--special',
        },
      ]
    }

    if (route.path === 'delivery-reading') {
      const closedCount = records.filter((record) => record.closed).length
      const openCount = records.filter((record) => !record.closed).length
      const turboCount = records.filter((record) => record.turbo).length

      return [
        {
          label: 'Leituras do dia',
          value: String(records.length).padStart(2, '0'),
          meta: 'codigos lidos neste turno',
          badgeText: 'leitura',
          badgeClass: 'ui-badge--info',
        },
        {
          label: 'Fechadas',
          value: String(closedCount).padStart(2, '0'),
          meta: 'entregas ja fechadas na operacao',
          badgeText: 'ok',
          badgeClass: 'ui-badge--success',
        },
        {
          label: 'Em aberto',
          value: String(openCount).padStart(2, '0'),
          meta: 'leituras aguardando fechamento',
          badgeText: 'pendente',
          badgeClass: 'ui-badge--warning',
        },
        {
          label: 'Turbo',
          value: String(turboCount).padStart(2, '0'),
          meta: 'entregas marcadas como turbo',
          badgeText: 'turbo',
          badgeClass: 'ui-badge--special',
        },
      ]
    }

    if (!manager || content.metrics.length === 0) {
      return content.metrics
    }

    return [
      {
        label: 'Registros do dia',
        value: String(records.length).padStart(2, '0'),
        meta: 'cadastros manuais ativos neste modulo',
        badgeText: 'manual',
        badgeClass: 'ui-badge--info',
      },
      {
        label: 'Atualizacao',
        value: records.length > 0 ? 'Ativa' : 'Aguardando',
        meta:
          records.length > 0
            ? canSyncModuleRecords
              ? 'base compartilhada pronta para consulta e exclusao'
              : 'base local pronta para consulta e exclusao'
            : 'adicione o primeiro registro para iniciar o modulo',
        badgeText: records.length > 0 ? 'online' : 'vazio',
        badgeClass: records.length > 0 ? 'ui-badge--success' : 'ui-badge--warning',
      },
      {
        label: 'Persistencia',
        value: canSyncModuleRecords ? 'Compartilhada' : 'Local',
        meta: canSyncModuleRecords
          ? 'registros sincronizados entre dispositivos da loja'
          : 'registros salvos neste dispositivo',
        badgeText: canSyncModuleRecords ? 'sync' : 'storage',
        badgeClass: canSyncModuleRecords ? 'ui-badge--success' : 'ui-badge--special',
      },
    ]
  }, [canSyncModuleRecords, content.metrics, machineChecklistRecords, manager, records, route.path])

  const statusField = managerWithResolvedFields?.fields.find((field) => field.name === 'status')
  const scheduleMachineField = managerWithResolvedFields?.fields.find(
    (field) => field.name === 'machine',
  )
  const scheduleMachineOptions = scheduleMachineField?.options ?? ['Sem maquininha']
  const visibleMetrics = route.path === 'machines' ? metrics.slice(0, 2) : metrics
  const visibleRecords = useMemo(() => {
    if (!manager) {
      return []
    }

    const filteredRecords = records.filter((record) => {
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesSearch =
        searchTerm.trim().length === 0 ||
        manager.toRow(record).join(' ').toLowerCase().includes(searchTerm.trim().toLowerCase())

      return matchesStatus && matchesSearch
    })

    if (route.path !== 'delivery-reading') {
      return filteredRecords
    }

    return [...filteredRecords].sort((left, right) => {
      const leftTimestamp = new Date(left.createdAtClient ?? 0).getTime()
      const rightTimestamp = new Date(right.createdAtClient ?? 0).getTime()

      return rightTimestamp - leftTimestamp
    })
  }, [manager, records, route.path, searchTerm, statusFilter])

  const tableColumns = manager ? [...manager.columns, 'Acoes'] : content.table.columns
  const tableRows = manager
    ? visibleRecords.map((record) => manager.toRow(record))
    : content.table.rows
  const visibleMachineChecklistRecords = useMemo(() => {
    if (route.path !== 'machines') {
      return []
    }

    return machineChecklistRecords.filter((record) => {
      const matchesStatus = statusFilter === 'all' || record.machineStatus === statusFilter
      const rawText = [
        record.device,
        record.holder,
        record.model,
        record.status,
        record.machineStatus,
      ]
        .join(' ')
        .toLowerCase()
      const matchesSearch =
        searchTerm.trim().length === 0 || rawText.includes(searchTerm.trim().toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [machineChecklistRecords, route.path, searchTerm, statusFilter])
  const presentMachineChecklistRecords = useMemo(
    () => visibleMachineChecklistRecords.filter((record) => record.status === 'Presente'),
    [visibleMachineChecklistRecords],
  )
  const visibleOpenDeliveryRecords = useMemo(
    () =>
      route.path === 'delivery-reading' ? visibleRecords.filter((record) => !record.closed) : [],
    [route.path, visibleRecords],
  )
  const visibleClosedDeliveryRecords = useMemo(
    () =>
      route.path === 'delivery-reading' ? visibleRecords.filter((record) => record.closed) : [],
    [route.path, visibleRecords],
  )
  const deliveredChangeRecords = useMemo(() => {
    if (route.path !== 'change') {
      return []
    }

    return [...records]
      .filter((record) => isCompletedChangeRecord(record))
      .sort((left, right) => {
        const leftTimestamp = new Date(left.updatedAtClient ?? left.createdAtClient ?? 0).getTime()
        const rightTimestamp = new Date(
          right.updatedAtClient ?? right.createdAtClient ?? 0,
        ).getTime()

        return rightTimestamp - leftTimestamp
      })
  }, [records, route.path])
  const deliveredChangeTotalValue = useMemo(
    () =>
      deliveredChangeRecords.reduce((total, record) => total + parseCurrencyValue(record.value), 0),
    [deliveredChangeRecords],
  )
  const deliveredChangeCourierCount = useMemo(
    () =>
      new Set(
        deliveredChangeRecords
          .map((record) => String(record.destination ?? '').trim())
          .filter(Boolean),
      ).size,
    [deliveredChangeRecords],
  )
  const closedDeliveryRecords = useMemo(() => {
    if (route.path !== 'delivery-reading') {
      return []
    }

    return [...records]
      .filter((record) => Boolean(record.closed))
      .sort((left, right) => {
        const leftTimestamp = new Date(left.updatedAtClient ?? left.createdAtClient ?? 0).getTime()
        const rightTimestamp = new Date(
          right.updatedAtClient ?? right.createdAtClient ?? 0,
        ).getTime()

        return rightTimestamp - leftTimestamp
      })
  }, [records, route.path])
  const closedDeliveryCourierCount = useMemo(
    () =>
      new Set(
        closedDeliveryRecords.map((record) => String(record.courier ?? '').trim()).filter(Boolean),
      ).size,
    [closedDeliveryRecords],
  )
  const paidAdvanceRecords = useMemo(() => {
    if (route.path !== 'advances') {
      return []
    }

    return [...records]
      .filter((record) =>
        String(record.status ?? '')
          .trim()
          .toLowerCase()
          .includes('baixad'),
      )
      .sort((left, right) => {
        const leftTimestamp = new Date(left.updatedAtClient ?? left.date ?? 0).getTime()
        const rightTimestamp = new Date(right.updatedAtClient ?? right.date ?? 0).getTime()

        return rightTimestamp - leftTimestamp
      })
  }, [records, route.path])
  const paidAdvanceTotalValue = useMemo(
    () => paidAdvanceRecords.reduce((total, record) => total + parseCurrencyValue(record.value), 0),
    [paidAdvanceRecords],
  )
  const paidAdvanceRecipientCount = useMemo(
    () =>
      new Set(
        paidAdvanceRecords.map((record) => String(record.recipient ?? '').trim()).filter(Boolean),
      ).size,
    [paidAdvanceRecords],
  )
  const usedScheduleMachines = useMemo(() => {
    if (route.path !== 'schedule') {
      return []
    }

    const groupedMachines = visibleRecords.reduce((accumulator, record) => {
      const machineLabel = typeof record.machine === 'string' ? record.machine.trim() : ''

      if (!machineLabel || machineLabel === 'Sem maquininha') {
        return accumulator
      }

      const currentEntry = accumulator.get(machineLabel) ?? {
        device: machineLabel,
        couriers: [],
      }

      if (record.courier && !currentEntry.couriers.includes(record.courier)) {
        currentEntry.couriers.push(record.courier)
      }

      accumulator.set(machineLabel, currentEntry)
      return accumulator
    }, new Map())

    return Array.from(groupedMachines.values()).sort((left, right) =>
      left.device.localeCompare(right.device, 'pt-BR'),
    )
  }, [route.path, visibleRecords])
  const deliveryReadingCourierOptions = useMemo(
    () =>
      managerWithResolvedFields?.fields.find((field) => field.name === 'courier')?.options ?? [],
    [managerWithResolvedFields],
  )
  const changeDestinationOptions = useMemo(
    () =>
      managerWithResolvedFields?.fields.find((field) => field.name === 'destination')?.options ??
      [],
    [managerWithResolvedFields],
  )
  const scheduleCourierOptions = useMemo(
    () =>
      managerWithResolvedFields?.fields.find((field) => field.name === 'courier')?.options ?? [],
    [managerWithResolvedFields],
  )
  const formNoticeMessage = useMemo(() => {
    if (route.path === 'delivery-reading' && !hasValidOptions(deliveryReadingCourierOptions)) {
      return 'Cadastre ou escale pelo menos um entregador valido antes de registrar leituras.'
    }

    if (route.path === 'change' && !hasValidOptions(changeDestinationOptions)) {
      return 'Cadastre entregadores validos antes de liberar trocos no turno.'
    }

    if (route.path === 'schedule' && !hasValidOptions(scheduleCourierOptions)) {
      return 'Cadastre entregadores validos antes de montar a escala do dia.'
    }

    return ''
  }, [changeDestinationOptions, deliveryReadingCourierOptions, route.path, scheduleCourierOptions])

  const syncModeLabel =
    pendingSyncCount > 0 ? 'Pendente' : remoteSyncReady ? 'Compartilhada' : 'Local'
  const resetLabel =
    manager?.dailyResetHour != null
      ? `${String(manager.dailyResetHour).padStart(2, '0')}h`
      : 'Sem reset'

  function updateField(name, value) {
    if (
      route.path === 'delivery-reading' &&
      name === 'deliveryCode' &&
      invalidFieldName === 'deliveryCode'
    ) {
      setInvalidFieldName('')
    }

    setFormValues((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function handleSchedulePrefill(windowLabel) {
    setFormValues((current) => ({
      ...current,
      window: windowLabel,
    }))
    setHighlightedScheduleRecordId('')
    setFocusFieldKey((current) => current + 1)
  }

  function handleScheduleHighlight(recordId) {
    setHighlightedScheduleRecordId(recordId)
  }

  async function markAssignedMachineAsPresent(machineName, auditContext) {
    if (!machineName || machineName === 'Sem maquininha') {
      return
    }

    const existingChecklistRecord =
      machineChecklistState.find((item) => item.device === machineName) ??
      machineChecklistRecords.find((item) => item.device === machineName)
    const sourceMachineRecord = availableMachineRecords.find((item) => item.device === machineName)
    const nextChecklistRecord = {
      id:
        existingChecklistRecord?.id ??
        sourceMachineRecord?.id ??
        `machine-check-${machineName.toLowerCase().replace(/\s+/g, '-')}`,
      device: machineName,
      holder: existingChecklistRecord?.holder ?? sourceMachineRecord?.holder ?? 'Nenhum',
      model: existingChecklistRecord?.model ?? sourceMachineRecord?.model ?? 'Nao informado',
      status: 'Presente',
      machineStatus:
        existingChecklistRecord?.machineStatus ?? sourceMachineRecord?.status ?? 'Ativa',
      updatedAt: auditContext.updatedAt,
      updatedBy: auditContext.updatedBy,
    }

    await saveRecordWithFallback({
      modulePath: 'machine-history',
      storageKey: 'nexus-module-machine-history',
      dailyResetHour: 3,
      record: nextChecklistRecord,
      onLocalApply: () => {
        setMachineChecklistState((current) => {
          const existingRecord = current.find(
            (item) => item.id === nextChecklistRecord.id || item.device === machineName,
          )

          if (existingRecord) {
            return current.map((item) =>
              item.id === existingRecord.id ? nextChecklistRecord : item,
            )
          }

          return [nextChecklistRecord, ...current]
        })

        setMachineChecklistRecords((current) => {
          const existingRecord = current.find(
            (item) => item.id === nextChecklistRecord.id || item.device === machineName,
          )

          if (existingRecord) {
            return current.map((item) =>
              item.id === existingRecord.id ? nextChecklistRecord : item,
            )
          }

          return [nextChecklistRecord, ...current]
        })
      },
    })
  }

  function resetManagedForm() {
    if (route.path === 'delivery-reading') {
      const preferredCourier =
        formValues.courier?.trim() ||
        getPreferredDeliveryCourier(
          managerWithResolvedFields?.fields.find((field) => field.name === 'courier')?.options ??
            [],
        )

      setFormValues(buildDeliveryReadingFormState(managerWithResolvedFields, preferredCourier))
      setFocusFieldKey((current) => current + 1)
      setInvalidFieldName('')
      return
    }

    setFormValues(buildInitialFormState(managerWithResolvedFields))
  }

  function markDeliveryCodeInvalid() {
    setInvalidFieldName('deliveryCode')
    setFocusFieldKey((current) => current + 1)

    if (invalidFieldTimeoutRef.current) {
      window.clearTimeout(invalidFieldTimeoutRef.current)
    }

    invalidFieldTimeoutRef.current = window.setTimeout(() => {
      setInvalidFieldName('')
      invalidFieldTimeoutRef.current = null
    }, 2000)
  }

  function refreshPendingSyncCount() {
    setPendingSyncCount(getManualModulePendingCount(syncModulePaths))
  }

  function refreshSyncHistory() {
    setSyncHistory(getManualModuleSyncHistory(syncModulePaths))
  }

  function queueSyncOperation(operation) {
    enqueueManualModuleSyncOperation(operation)
    refreshPendingSyncCount()
    refreshSyncHistory()
    setSyncActivityLabel('Salvo localmente para reenviar')
  }

  async function saveRecordWithFallback({
    modulePath,
    storageKey,
    dailyResetHour = null,
    record,
    onLocalApply,
  }) {
    if (!canSyncModuleRecords) {
      onLocalApply()
      queueSyncOperation({
        type: 'save',
        modulePath,
        storageKey,
        dailyResetHour,
        record,
      })
      return 'local'
    }

    try {
      await saveManualModuleRecord({
        storeId: currentStoreId,
        tenantId,
        modulePath,
        storageKey,
        dailyResetHour,
        record,
      })
      onLocalApply()
      refreshPendingSyncCount()
      refreshSyncHistory()
      setSyncActivityLabel('Sincronizado em tempo real')
      return 'remote'
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error
      }

      onLocalApply()
      queueSyncOperation({
        type: 'save',
        modulePath,
        storageKey,
        dailyResetHour,
        record,
      })
      return 'local'
    }
  }

  async function deleteRecordWithFallback({ modulePath, recordId, onLocalApply }) {
    if (!canSyncModuleRecords) {
      onLocalApply()
      queueSyncOperation({
        type: 'delete',
        modulePath,
        recordId,
      })
      return 'local'
    }

    try {
      await deleteManualModuleRecord({
        storeId: currentStoreId,
        modulePath,
        recordId,
      })
      onLocalApply()
      refreshPendingSyncCount()
      refreshSyncHistory()
      setSyncActivityLabel('Exclusao sincronizada')
      return 'remote'
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error
      }

      onLocalApply()
      queueSyncOperation({
        type: 'delete',
        modulePath,
        recordId,
      })
      return 'local'
    }
  }

  async function clearRecordsWithFallback({
    modulePath,
    storageKey,
    initialRecords = [],
    dailyResetHour = null,
    onLocalApply,
  }) {
    if (!canSyncModuleRecords) {
      onLocalApply()
      queueSyncOperation({
        type: 'clear',
        modulePath,
        storageKey,
        initialRecords,
        dailyResetHour,
      })
      return 'local'
    }

    try {
      await clearManualModuleRecords({
        storeId: currentStoreId,
        modulePath,
        storageKey,
        initialRecords,
        dailyResetHour,
      })
      onLocalApply()
      refreshPendingSyncCount()
      refreshSyncHistory()
      setSyncActivityLabel('Limpeza sincronizada')
      return 'remote'
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error
      }

      onLocalApply()
      queueSyncOperation({
        type: 'clear',
        modulePath,
        storageKey,
        initialRecords,
        dailyResetHour,
      })
      return 'local'
    }
  }

  async function handleRetrySync() {
    if (localOnlyMode) {
      setErrorMessage('Desative o modo somente local para reenviar as pendencias.')
      playError()
      return
    }

    if (!isOnline) {
      setErrorMessage('Conecte este dispositivo para reenviar as pendencias.')
      playError()
      return
    }

    if (!currentStoreId || !canUseRemoteSync()) {
      setErrorMessage('A sincronizacao remota nao esta pronta nesta sessao.')
      playError()
      return
    }

    const result = await flushManualModuleSyncQueue({
      storeId: currentStoreId,
      tenantId,
      modulePaths: syncModulePaths,
    })

    setPendingSyncCount(result.pendingCount)
    refreshSyncHistory()

    if (result.flushedCount > 0) {
      setErrorMessage('')
      setSyncActivityLabel(`${result.flushedCount} pendencias reenviadas`)
      playOperationalSuccess()
      return
    }

    if (result.pendingCount > 0) {
      setErrorMessage('Ainda existem pendencias aguardando a base compartilhada responder.')
      playNotification()
      return
    }

    setErrorMessage('')
    setSyncActivityLabel('Nenhuma pendencia para reenviar')
    playNotification()
  }

  function downloadBackupFile(payload, fileLabel) {
    const fileDate = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
      .format(new Date())
      .replace(/\//g, '-')
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `${fileLabel}-${fileDate}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function handleExportBackup() {
    downloadBackupFile(
      {
        module: route.path,
        title: route.title,
        exportedAt: new Date().toISOString(),
        localOnlyMode,
        isOnline,
        pendingSyncCount,
        records,
        machineChecklistRecords: route.path === 'machines' ? machineChecklistRecords : [],
      },
      `backup-${route.path}`,
    )
    setSyncActivityLabel('Backup local exportado')
    playNotification()
  }

  async function handleToggleLocalMode() {
    const nextValue = !localOnlyMode

    setManualModuleLocalMode(nextValue)
    setLocalOnlyModeState(nextValue)

    if (nextValue) {
      setSyncActivityLabel('Modo somente local ativo')
      playNotification()
      return
    }

    setSyncActivityLabel('Voltando ao modo compartilhado')

    if (currentStoreId && isOnline && canUseRemoteSync()) {
      await handleRetrySync()
    } else {
      playNotification()
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!managerWithResolvedFields) {
      playError()
      return
    }

    if (route.path === 'delivery-reading' && !String(formValues.deliveryCode ?? '').trim()) {
      setErrorMessage('Informe o codigo da entrega.')
      markDeliveryCodeInvalid()
      toast.error('Informe o codigo da entrega.')
      playOperationalWarning()
      return
    }

    if (route.path === 'delivery-reading') {
      const deliveryCode = String(formValues.deliveryCode ?? '').trim()
      const selectedCourier = String(formValues.courier ?? '').trim()
      const alreadyRegistered = records.some(
        (record) => String(record.deliveryCode ?? '').trim() === deliveryCode,
      )

      if (isPlaceholderOption(selectedCourier)) {
        setErrorMessage('Selecione um entregador valido para registrar a leitura.')
        markDeliveryCodeInvalid()
        toast.error('Selecione um entregador valido.')
        playOperationalWarning()
        return
      }

      if (alreadyRegistered) {
        setErrorMessage(`O codigo ${deliveryCode} ja foi registrado neste turno.`)
        markDeliveryCodeInvalid()
        toast.error(`Codigo ${deliveryCode} ja registrado.`)
        playOperationalWarning()
        return
      }
    }

    if (route.path === 'change' && isPlaceholderOption(formValues.destination)) {
      setErrorMessage('Selecione um entregador valido para liberar o troco.')
      toast.error('Selecione um entregador valido.')
      playOperationalWarning()
      return
    }

    if (route.path === 'schedule' && isPlaceholderOption(formValues.courier)) {
      setErrorMessage('Selecione um entregador valido para montar a escala.')
      toast.error('Selecione um entregador valido.')
      playOperationalWarning()
      return
    }

    const newRecord = {
      ...manager.createRecord(formValues, buildAuditContext(session)),
      createdAtClient: new Date().toISOString(),
    }

    try {
      setIsSubmitting(true)
      await saveRecordWithFallback({
        modulePath: route.path,
        storageKey: manager.storageKey,
        dailyResetHour: manager.dailyResetHour ?? null,
        record: newRecord,
        onLocalApply: () => {
          setRecords((current) => normalizeManualRecords([newRecord, ...current]))
        },
      })

      if (route.path === 'delivery-reading') {
        const preferredCourier =
          formValues.courier?.trim() ||
          getPreferredDeliveryCourier(
            managerWithResolvedFields.fields.find((field) => field.name === 'courier')?.options ??
              [],
          )

        if (preferredCourier) {
          localStorage.setItem(DELIVERY_READING_LAST_COURIER_KEY, preferredCourier)
        }

        setFormValues(buildDeliveryReadingFormState(managerWithResolvedFields, preferredCourier))
        setFreshRecordId(newRecord.id)
        setFocusFieldKey((current) => current + 1)
        setInvalidFieldName('')
        toast.success(`Leitura registrada - codigo ${newRecord.deliveryCode}`)
      } else {
        setFormValues(buildInitialFormState(managerWithResolvedFields))
      }

      setErrorMessage('')
      playOperationalSuccess()
      const operationsSummary = buildOperationsAuditSummary(route.path, newRecord)

      appendAuditEvent({
        module: route.title,
        modulePath: route.path,
        recordId: newRecord.id,
        actor: session?.operatorName ?? session?.displayName ?? 'Operador local',
        action: 'Criou registro',
        target:
          operationsSummary?.target ??
          newRecord.deliveryCode ??
          newRecord.code ??
          newRecord.courier ??
          newRecord.device ??
          newRecord.zone ??
          newRecord.order ??
          newRecord.origin ??
          'registro manual',
        details: operationsSummary?.details ?? `Cadastro criado em ${route.title}`,
        value: operationsSummary?.value,
        courier: operationsSummary?.courier,
      })
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel salvar o registro.')
      if (route.path === 'delivery-reading') {
        markDeliveryCodeInvalid()
        toast.error(error.message ?? 'Nao foi possivel registrar a leitura.')
      }
      playError()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(recordId) {
    const record = records.find((item) => item.id === recordId)

    try {
      await deleteRecordWithFallback({
        modulePath: route.path,
        recordId,
        onLocalApply: () => {
          setRecords((current) => current.filter((item) => item.id !== recordId))
          if (route.path === 'machines') {
            setMachineChecklistRecords((current) => current.filter((item) => item.id !== recordId))
            setMachineChecklistState((current) => current.filter((item) => item.id !== recordId))
          }
        },
      })

      setErrorMessage('')
      playOperationalSuccess()

      const operationsSummary = buildOperationsAuditSummary(route.path, record)

      appendAuditEvent({
        module: route.title,
        modulePath: route.path,
        recordId: record?.id,
        actor: session?.operatorName ?? session?.displayName ?? 'Operador local',
        action: 'Excluiu registro',
        target:
          operationsSummary?.target ??
          record?.deliveryCode ??
          record?.code ??
          record?.courier ??
          record?.device ??
          record?.zone ??
          record?.order ??
          record?.origin ??
          'registro manual',
        details: operationsSummary?.details ?? `Registro removido de ${route.title}`,
        value: operationsSummary?.value,
        courier: operationsSummary?.courier,
      })
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel excluir o registro.')
      playError()
    }
  }

  function handleScheduleMachineDraftChange(recordId, value) {
    setScheduleMachineDrafts((current) => ({
      ...current,
      [recordId]: value,
    }))
  }

  function handleEditableRecordDraftChange(recordId, value) {
    setEditableRecordDrafts((current) => ({
      ...current,
      [recordId]: value,
    }))
  }

  function getEditableRecordFieldName() {
    if (route.path === 'change') {
      return 'origin'
    }

    if (route.path === 'advances') {
      return 'recipient'
    }

    return null
  }

  function getEditableRecordOptions() {
    if (route.path === 'change') {
      return storeUserOptions
    }

    if (route.path === 'advances') {
      return storeMemberOptions
    }

    return []
  }

  async function handleEditableRecordUpdate(recordId) {
    const fieldName = getEditableRecordFieldName()

    if (!fieldName || !manager) {
      return
    }

    const record = records.find((item) => item.id === recordId)

    if (!record) {
      playError()
      return
    }

    const currentValue = String(record[fieldName] ?? '').trim()
    const nextValue = String(editableRecordDrafts[recordId] ?? currentValue).trim()

    if (!nextValue || nextValue === currentValue) {
      return
    }

    if (isPlaceholderOption(nextValue)) {
      setErrorMessage('Selecione uma opcao valida antes de salvar.')
      playOperationalWarning()
      return
    }

    const auditContext = buildAuditContext(session)
    const nextRecord = {
      ...record,
      [fieldName]: nextValue,
      updatedAt: auditContext.updatedAt,
      updatedBy: auditContext.updatedBy,
    }

    try {
      await saveRecordWithFallback({
        modulePath: route.path,
        storageKey: manager.storageKey,
        dailyResetHour: manager.dailyResetHour ?? null,
        record: nextRecord,
        onLocalApply: () => {
          setRecords((current) => current.map((item) => (item.id === recordId ? nextRecord : item)))
        },
      })

      setEditableRecordDrafts((current) => {
        const nextDrafts = { ...current }
        delete nextDrafts[recordId]
        return nextDrafts
      })
      setErrorMessage('')
      playOperationalSuccess()
      appendAuditEvent({
        module: route.title,
        modulePath: route.path,
        recordId,
        actor: auditContext.updatedBy,
        action:
          route.path === 'change' ? 'Alterou operador do troco' : 'Alterou entregador do vale',
        target: route.path === 'change' ? nextValue : (record.value ?? 'vale'),
        details:
          route.path === 'change'
            ? `Operador do troco atualizado para ${nextValue}`
            : `Entregador do vale atualizado para ${nextValue}`,
        value: record.value ?? '',
        courier: route.path === 'advances' ? nextValue : (record.destination ?? ''),
      })
    } catch (error) {
      setErrorMessage(
        error.message ??
          (route.path === 'change'
            ? 'Nao foi possivel atualizar o operador do troco.'
            : 'Nao foi possivel atualizar o entregador do vale.'),
      )
      playError()
    }
  }

  async function handleScheduleMachineUpdate(recordId) {
    if (route.path !== 'schedule') {
      return
    }

    const record = records.find((item) => item.id === recordId)

    if (!record) {
      playError()
      return
    }

    const nextMachine =
      (scheduleMachineDrafts[recordId] ?? record.machine ?? 'Sem maquininha').trim() ||
      'Sem maquininha'
    const auditContext = buildAuditContext(session)

    if (nextMachine === record.machine) {
      return
    }

    const nextRecord = {
      ...record,
      machine: nextMachine,
      updatedAt: auditContext.updatedAt,
      updatedBy: auditContext.updatedBy,
    }

    try {
      await saveRecordWithFallback({
        modulePath: route.path,
        storageKey: manager.storageKey,
        dailyResetHour: manager.dailyResetHour ?? null,
        record: nextRecord,
        onLocalApply: () => {
          setRecords((current) => current.map((item) => (item.id === recordId ? nextRecord : item)))
        },
      })

      await markAssignedMachineAsPresent(nextMachine, auditContext)

      setScheduleMachineDrafts((current) => {
        const nextDrafts = { ...current }
        delete nextDrafts[recordId]
        return nextDrafts
      })
      setErrorMessage('')
      playOperationalSuccess()
      appendAuditEvent({
        module: route.title,
        modulePath: route.path,
        recordId,
        actor: auditContext.updatedBy,
        action: 'Alterou maquininha do dia na escala',
        target: record.courier ?? 'entregador',
        details: `Maquininha do dia atualizada para ${nextMachine}`,
      })
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel atualizar a maquininha do dia na escala.')
      playError()
    }
  }

  async function handleClearAll() {
    const confirmed = await confirm.ask({
      title: 'Limpar registros',
      message: `Confirma a limpeza de todos os registros de ${route.title}?`,
      confirmLabel: 'Limpar registros',
      tone: 'danger',
    })

    if (!confirmed) {
      return
    }

    try {
      await clearRecordsWithFallback({
        modulePath: route.path,
        storageKey: manager?.storageKey,
        initialRecords: manager?.initialRecords ?? [],
        dailyResetHour: manager?.dailyResetHour ?? null,
        onLocalApply: () => {
          setRecords([])
        },
      })

      setErrorMessage('')
      toast.success(`${route.title} limpo com sucesso`)
      playNotification()
      appendAuditEvent({
        module: route.title,
        modulePath: route.path,
        actor: session?.operatorName ?? session?.displayName ?? 'Operador local',
        action: 'Limpou modulo',
        target: route.title,
        details: 'Todos os registros locais foram removidos',
      })
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel limpar os registros do modulo.')
      playError()
    }
  }

  async function handleManualReset() {
    if (!manager?.manualResetLabel) {
      return
    }

    const confirmed = await confirm.ask({
      title: 'Resetar modulo',
      message: `Confirma o reset manual de ${route.title} neste turno?`,
      confirmLabel: manager.manualResetLabel,
      tone: 'warning',
    })

    if (!confirmed) {
      return
    }

    try {
      const nextRecords =
        route.path === 'machine-history'
          ? buildRouteRecords(route.path, manager)
          : resetLocalRecordsNow(manager.storageKey, [], manager.dailyResetHour ?? 3)
      await clearRecordsWithFallback({
        modulePath: route.path,
        storageKey: manager.storageKey,
        initialRecords: [],
        dailyResetHour: manager.dailyResetHour ?? 3,
        onLocalApply: () => {
          setRecords(nextRecords)
        },
      })

      setErrorMessage('')
      toast.success(`${route.title} resetado para o dia atual`)
      playNotification()
      appendAuditEvent({
        module: route.title,
        modulePath: route.path,
        actor: session?.operatorName ?? session?.displayName ?? 'Operador local',
        action: 'Reset manual',
        target: route.title,
        details: 'Modulo resetado manualmente pela operacao',
      })
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel resetar o modulo.')
      playError()
    }
  }

  function buildExportFileName(fileLabel, extension = 'png') {
    const today = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
      .format(new Date())
      .replace(/\//g, '-')

    return `${fileLabel} (${today}).${extension}`
  }

  async function buildExportImageDataUrl(targetRef, fileLabel, failureMessage) {
    if (!targetRef?.current) {
      setErrorMessage(failureMessage)
      playError()
      return null
    }

    const exportNode = targetRef.current.cloneNode(true)
    const exportSandbox = document.createElement('div')

    exportNode.classList.add('schedule-export-image__canvas--light')

    exportSandbox.setAttribute('data-export-sandbox', fileLabel)
    exportSandbox.style.position = 'fixed'
    exportSandbox.style.left = '0'
    exportSandbox.style.top = '0'
    exportSandbox.style.width = '0'
    exportSandbox.style.height = '0'
    exportSandbox.style.overflow = 'visible'
    exportSandbox.style.opacity = '0.01'
    exportSandbox.style.pointerEvents = 'none'
    exportSandbox.style.zIndex = '2147483647'

    exportNode.style.position = 'relative'
    exportNode.style.left = '24px'
    exportNode.style.top = '24px'
    exportNode.style.inset = 'auto'
    exportNode.style.transform = 'none'
    exportNode.style.opacity = '1'
    exportNode.style.pointerEvents = 'none'

    exportSandbox.appendChild(exportNode)
    document.body.appendChild(exportSandbox)

    try {
      setErrorMessage('')
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
      const toPng = await loadToPng()

      return await toPng(exportNode, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#f7fafc',
        skipFonts: true,
      })
    } catch {
      playError()
      setErrorMessage(failureMessage)
      return null
    } finally {
      exportSandbox.remove()
    }
  }

  async function exportImageFromRef(targetRef, fileLabel, failureMessage) {
    const dataUrl = await buildExportImageDataUrl(targetRef, fileLabel, failureMessage)

    if (!dataUrl) {
      return
    }

    const link = document.createElement('a')
    const filename = buildExportFileName(fileLabel, 'png')

    link.href = dataUrl
    link.download = filename
    link.rel = 'noopener'
    link.target = '_self'
    document.body.appendChild(link)
    link.click()
    link.remove()
    playNotification()
  }

  async function handleExportScheduleImage() {
    if (route.path !== 'schedule') {
      playError()
      return
    }

    if (visibleRecords.length === 0) {
      setErrorMessage('Nao ha entregadores na escala para exportar.')
      playOperationalWarning()
      return
    }

    await exportImageFromRef(
      scheduleImageRef,
      'escala do dia',
      'Nao foi possivel exportar a escala como imagem.',
    )
  }

  async function handleExportScheduleMachinesImage() {
    if (route.path !== 'schedule') {
      playError()
      return
    }

    if (usedScheduleMachines.length === 0) {
      setErrorMessage('Nao ha maquininhas utilizadas hoje para exportar.')
      playOperationalWarning()
      return
    }

    await exportImageFromRef(
      scheduleMachinesImageRef,
      'maquininhas utilizadas no dia',
      'Nao foi possivel exportar as maquininhas utilizadas como imagem.',
    )
  }

  async function handleExportMachineChecklistImage() {
    if (route.path !== 'machines') {
      playError()
      return
    }

    if (presentMachineChecklistRecords.length === 0) {
      setErrorMessage('Nao ha maquininhas presentes hoje para exportar.')
      playOperationalWarning()
      return
    }

    await exportImageFromRef(
      machineChecklistImageRef,
      'maquininhas do dia',
      'Nao foi possivel exportar as maquininhas presentes como imagem.',
    )
  }

  async function handleExportDeliveredChangesImage() {
    if (route.path !== 'change') {
      playError()
      return
    }

    if (deliveredChangeRecords.length === 0) {
      setErrorMessage('Nao ha trocos concluidos hoje para exportar.')
      playOperationalWarning()
      return
    }

    await exportImageFromRef(
      changeDeliveredImageRef,
      'trocos entregues do dia',
      'Nao foi possivel exportar os trocos entregues do dia.',
    )
  }

  async function handlePrintDeliveredChanges() {
    if (route.path !== 'change') {
      playError()
      return
    }

    if (deliveredChangeRecords.length === 0) {
      setErrorMessage('Nao ha trocos concluidos hoje para imprimir.')
      playOperationalWarning()
      return
    }

    try {
      printOperationalReport({
        title: 'Trocos entregues do dia',
        subtitle: 'Relatorio termico operacional',
        meta: formatChecklistDate(),
        summary: [
          { label: 'Retornos', value: String(deliveredChangeRecords.length) },
          { label: 'Total', value: formatCurrencyValue(deliveredChangeTotalValue) },
          { label: 'Entregadores', value: String(deliveredChangeCourierCount) },
        ],
        records: deliveredChangeRecords.map((record) => ({
          title: record.destination || 'Entregador nao informado',
          badge: 'Concluido',
          subtitle: record.origin || 'Operador nao informado',
          fields: [
            { label: 'Operador', value: record.origin || 'Nao informado' },
            { label: 'Valor', value: record.value || formatCurrencyValue(0) },
            {
              label: 'Retorno',
              value:
                record.returnedAt && record.returnedBy
                  ? `${record.returnedBy} - ${record.returnedAt}`
                  : 'Confirmado sem horario informado',
            },
          ],
        })),
        footer: `${session?.operatorName ?? session?.displayName ?? 'Operador local'} · ${formatChecklistDate()}`,
      })
      playNotification()
    } catch {
      setErrorMessage('Nao foi possivel preparar a impressao dos trocos entregues do dia.')
      playError()
    }
  }

  async function handleExportClosedDeliveriesImage() {
    if (route.path !== 'delivery-reading') {
      playError()
      return
    }

    if (closedDeliveryRecords.length === 0) {
      setErrorMessage('Nao ha leituras fechadas hoje para exportar.')
      playOperationalWarning()
      return
    }

    await exportImageFromRef(
      deliveryReadingClosedImageRef,
      'leituras fechadas do dia',
      'Nao foi possivel exportar as leituras fechadas do dia.',
    )
  }

  async function handlePrintClosedDeliveries() {
    if (route.path !== 'delivery-reading') {
      playError()
      return
    }

    if (closedDeliveryRecords.length === 0) {
      setErrorMessage('Nao ha leituras fechadas hoje para imprimir.')
      playOperationalWarning()
      return
    }

    try {
      printOperationalReport({
        title: 'Leituras fechadas do dia',
        subtitle: 'Relatorio termico operacional',
        meta: formatChecklistDate(),
        summary: [
          { label: 'Fechadas', value: String(closedDeliveryRecords.length) },
          { label: 'Entregadores', value: String(closedDeliveryCourierCount) },
          {
            label: 'Turbo',
            value: String(closedDeliveryRecords.filter((record) => record.turbo).length),
          },
        ],
        records: closedDeliveryRecords.map((record) => ({
          title: record.courier || 'Entregador nao informado',
          badge: 'Fechada',
          subtitle: record.deliveryCode || 'Codigo nao informado',
          fields: [
            { label: 'Codigo', value: record.deliveryCode || 'Nao informado' },
            { label: 'Turno', value: record.turn || 'Nao informado' },
            { label: 'Tipo', value: record.turbo ? 'Turbo' : 'Padrao' },
          ],
        })),
        footer: `${session?.operatorName ?? session?.displayName ?? 'Operador local'} · ${formatChecklistDate()}`,
      })
      playNotification()
    } catch {
      setErrorMessage('Nao foi possivel preparar a impressao das leituras fechadas do dia.')
      playError()
    }
  }

  async function handleExportPaidAdvancesImage() {
    if (route.path !== 'advances') {
      playError()
      return
    }

    if (paidAdvanceRecords.length === 0) {
      setErrorMessage('Nao ha vales baixados hoje para exportar.')
      playOperationalWarning()
      return
    }

    await exportImageFromRef(
      advancesPaidImageRef,
      'vales baixados do dia',
      'Nao foi possivel exportar os vales baixados do dia.',
    )
  }

  async function handlePrintPaidAdvances() {
    if (route.path !== 'advances') {
      playError()
      return
    }

    if (paidAdvanceRecords.length === 0) {
      setErrorMessage('Nao ha vales baixados hoje para imprimir.')
      playOperationalWarning()
      return
    }

    try {
      printOperationalReport({
        title: 'Vales baixados do dia',
        subtitle: 'Relatorio termico operacional',
        meta: formatChecklistDate(),
        summary: [
          { label: 'Baixados', value: String(paidAdvanceRecords.length) },
          { label: 'Total', value: formatCurrencyValue(paidAdvanceTotalValue) },
          { label: 'Entregadores', value: String(paidAdvanceRecipientCount) },
        ],
        records: paidAdvanceRecords.map((record) => ({
          title: record.recipient || 'Entregador nao informado',
          badge: 'Baixado',
          subtitle: record.reason || 'Motivo nao informado',
          fields: [
            { label: 'Valor', value: record.value || formatCurrencyValue(0) },
            { label: 'Data', value: record.date || 'Nao informada' },
            { label: 'Motivo', value: record.reason || 'Nao informado' },
          ],
        })),
        footer: `${session?.operatorName ?? session?.displayName ?? 'Operador local'} · ${formatChecklistDate()}`,
      })
      playNotification()
    } catch {
      setErrorMessage('Nao foi possivel preparar a impressao dos vales baixados do dia.')
      playError()
    }
  }

  function handleMarkReturned(recordId) {
    if (!manager?.markReturned) {
      return
    }

    const { updatedAt: returnedAt, updatedBy: returnedBy } = buildAuditContext(session)
    const targetRecord = records.find((item) => item.id === recordId)
    const nextRecord = targetRecord
      ? manager.markReturned(targetRecord, { returnedAt, returnedBy })
      : null

    if (!nextRecord) {
      return
    }

    saveRecordWithFallback({
      modulePath: route.path,
      storageKey: manager.storageKey,
      dailyResetHour: manager.dailyResetHour ?? null,
      record: nextRecord,
      onLocalApply: () => {
        setRecords((current) =>
          current.map((record) => (record.id === recordId ? nextRecord : record)),
        )
      },
    })
      .then(() => {
        playOperationalSuccess()
        appendAuditEvent({
          module: route.title,
          modulePath: route.path,
          recordId,
          actor: returnedBy,
          action: 'Confirmou retorno',
          target: targetRecord?.destination ?? 'entregador',
          details: `Troco de ${targetRecord?.value ?? 'R$ 0,00'} retornado para ${targetRecord?.destination ?? 'entregador'}`,
          value: targetRecord?.value ?? '',
          courier: targetRecord?.destination ?? '',
        })
      })
      .catch(() => {
        playError()
        setErrorMessage('Nao foi possivel atualizar o retorno do troco.')
      })
  }

  async function handleApplyAction(recordId) {
    if (!manager?.applyAction) {
      return
    }

    const auditContext = buildAuditContext(session)
    const targetRecord = records.find((item) => item.id === recordId)
    const nextRecord = targetRecord ? manager.applyAction(targetRecord, auditContext) : null

    if (!nextRecord) {
      return
    }

    try {
      await saveRecordWithFallback({
        modulePath: route.path,
        storageKey: manager.storageKey,
        dailyResetHour: manager.dailyResetHour ?? null,
        record: nextRecord,
        onLocalApply: () => {
          setRecords((current) =>
            current.map((record) => (record.id === recordId ? nextRecord : record)),
          )
        },
      })

      if (route.path === 'delivery-reading' && !targetRecord.closed) {
        setRecentlyClosedRecordId(recordId)
      }
      setErrorMessage('')
      playOperationalSuccess()
      const operationsSummary = buildOperationsAuditSummary(route.path, targetRecord)

      appendAuditEvent({
        module: route.title,
        modulePath: route.path,
        recordId,
        actor: auditContext.updatedBy,
        action: manager.actionLabel ?? 'Atualizou registro',
        target:
          operationsSummary?.target ??
          targetRecord.deliveryCode ??
          targetRecord.code ??
          targetRecord.device ??
          targetRecord.order ??
          targetRecord.origin ??
          targetRecord.zone ??
          'registro manual',
        details: operationsSummary?.details ?? `Acao aplicada em ${route.title}`,
        value: operationsSummary?.value,
        courier: operationsSummary?.courier,
      })
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel atualizar o registro.')
      playError()
    }
  }

  async function handleMachineChecklistToggle(recordId) {
    const auditContext = buildAuditContext(session)
    const record = machineChecklistRecords.find((item) => item.id === recordId)

    if (!record) {
      return
    }

    const nextStatus = record.status === 'Presente' ? 'Ausente' : 'Presente'
    const nextRecord = {
      ...record,
      status: nextStatus,
      updatedAt: auditContext.updatedAt,
      updatedBy: auditContext.updatedBy,
    }

    try {
      await saveRecordWithFallback({
        modulePath: 'machine-history',
        storageKey: 'nexus-module-machine-history',
        dailyResetHour: 3,
        record: nextRecord,
        onLocalApply: () => {
          setMachineChecklistRecords((current) =>
            current.map((item) => (item.id === recordId ? nextRecord : item)),
          )
          setMachineChecklistState((current) => {
            const existingRecord = current.find((item) => item.id === recordId)

            if (existingRecord) {
              return current.map((item) => (item.id === recordId ? nextRecord : item))
            }

            return [nextRecord, ...current]
          })
        },
      })

      setErrorMessage('')
      toast.success('Registro excluido')
      playOperationalSuccess()

      appendAuditEvent({
        module: 'Maquininhas',
        modulePath: 'machines',
        recordId: record?.id,
        actor: auditContext.updatedBy,
        action:
          nextStatus === 'Presente'
            ? 'Marcou presente no checklist'
            : 'Desmarcou presenca no checklist',
        target: record?.device ?? 'maquininha',
        details: `Checklist atualizado para ${record?.device ?? 'maquininha'}`,
      })
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel atualizar o checklist da maquininha.')
      playError()
    }
  }

  async function handleConfirmAllMachines() {
    const recordsToConfirm = visibleMachineChecklistRecords.filter(
      (record) => record.status !== 'Presente',
    )

    if (recordsToConfirm.length === 0) {
      return
    }

    const auditContext = buildAuditContext(session)
    const nextRecords = recordsToConfirm.map((record) => ({
      ...record,
      status: 'Presente',
      updatedAt: auditContext.updatedAt,
      updatedBy: auditContext.updatedBy,
    }))

    try {
      await Promise.all(
        nextRecords.map((nextRecord) =>
          saveRecordWithFallback({
            modulePath: 'machine-history',
            storageKey: 'nexus-module-machine-history',
            dailyResetHour: 3,
            record: nextRecord,
            onLocalApply: () => {
              setMachineChecklistRecords((current) =>
                current.map((item) => (item.id === nextRecord.id ? nextRecord : item)),
              )
              setMachineChecklistState((current) => {
                const existingRecord = current.find((item) => item.id === nextRecord.id)

                if (existingRecord) {
                  return current.map((item) => (item.id === nextRecord.id ? nextRecord : item))
                }

                return [nextRecord, ...current]
              })
            },
          }),
        ),
      )

      setErrorMessage('')
      playOperationalSuccess()
      toast.success(`${recordsToConfirm.length} maquininhas confirmadas`)
      nextRecords.forEach((record) => {
        appendAuditEvent({
          module: 'Maquininhas',
          modulePath: 'machines',
          recordId: record.id,
          actor: auditContext.updatedBy,
          action: 'Marcou presente no checklist',
          target: record.device ?? 'maquininha',
          details: `Checklist atualizado para ${record.device ?? 'maquininha'}`,
        })
      })
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel confirmar as maquininhas em massa.')
      toast.error(error.message ?? 'Nao foi possivel confirmar as maquininhas.')
      playError()
    }
  }

  const machineHistoryEvents =
    route.path === 'machine-history'
      ? loadAuditEvents()
          .filter(
            (event) =>
              event.modulePath === 'machines' && event.action.toLowerCase().includes('checklist'),
          )
          .map((event) => {
            const eventDate = new Date(event.timestamp)
            return {
              id: event.id,
              dayKey: resolveAuditEventDayKey(event),
              dayLabel: new Intl.DateTimeFormat('pt-BR', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
                .format(eventDate)
                .replace(/\./g, '')
                .toUpperCase(),
              device: event.target,
              actor: event.actor,
              action: event.action,
              time: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(
                eventDate,
              ),
            }
          })
      : []

  const machineHistoryGroups =
    route.path === 'machine-history'
      ? Array.from(
          machineHistoryEvents
            .reduce((accumulator, event) => {
              const currentGroup = accumulator.get(event.dayKey) ?? {
                dayKey: event.dayKey,
                dayLabel: event.dayLabel,
                entries: [],
              }

              currentGroup.entries.push(event)
              accumulator.set(event.dayKey, currentGroup)
              return accumulator
            }, new Map())
            .values(),
        )
      : []

  const isMachineChecklist = route.path === 'machines'
  const visibleCount = isMachineChecklist ? visibleMachineChecklistRecords.length : tableRows.length
  const tableTitle = isMachineChecklist ? 'Maquininhas cadastradas' : content.table.title

  return (
    <div className={`page-stack native-module-page native-module-page--${route.path}`}>
      <PageIntro eyebrow={route.eyebrow} title={route.title} description={route.description} />

      {!manager || route.path === 'machines' ? (
        <div className="card-grid native-module__kpi-grid">
          {visibleMetrics.map((metric) => (
            <MetricCard
              key={`${route.path}-${metric.label}`}
              label={metric.label}
              value={metric.value}
              meta={metric.meta}
              badgeText={metric.badgeText}
              badgeClass={metric.badgeClass}
              className="native-module__kpi-card"
            />
          ))}
        </div>
      ) : null}

      {manager ? (
        <NativeModuleStatusBar
          syncModeLabel={syncModeLabel}
          pendingCount={pendingSyncCount}
          resetLabel={resetLabel}
          recordsCount={records.length}
          isOnline={isOnline}
          localOnlyMode={localOnlyMode}
          errorMessage={errorMessage}
          onRetrySync={handleRetrySync}
          onToggleLocalMode={handleToggleLocalMode}
          retryDisabled={!remoteSyncReady || pendingSyncCount === 0}
        />
      ) : null}

      <NativeModuleFormCard
        manager={manager}
        managerWithResolvedFields={managerWithResolvedFields}
        routePath={route.path}
        recordsLength={records.length}
        formValues={formValues}
        onSubmit={handleSubmit}
        onReset={resetManagedForm}
        updateField={updateField}
        isSubmitting={isSubmitting}
        focusFieldKey={focusFieldKey}
        invalidFieldName={invalidFieldName}
        noticeMessage={formNoticeMessage}
        submitDisabledReason={formNoticeMessage}
      />

      {!manager ? (
        <NativeModulePanels
          routePath={route.path}
          panels={content.panels}
          renderPanel={renderPanel}
        />
      ) : null}

      <NativeModuleRecordsSection
        route={route}
        manager={manager}
        tableTitle={tableTitle}
        errorMessage={errorMessage}
        records={records}
        tableRows={tableRows}
        machineHistoryGroups={machineHistoryGroups}
        visibleOpenDeliveryRecords={visibleOpenDeliveryRecords}
        visibleClosedDeliveryRecords={visibleClosedDeliveryRecords}
        recentlyClosedRecordId={recentlyClosedRecordId}
        visibleRecords={visibleRecords}
        visibleMachineChecklistRecords={visibleMachineChecklistRecords}
        machineConfirmedCount={presentMachineChecklistRecords.length}
        formatAuditText={formatAuditText}
        handleApplyAction={handleApplyAction}
        handleDelete={handleDelete}
        handleMachineChecklistToggle={handleMachineChecklistToggle}
        handleConfirmAllMachines={handleConfirmAllMachines}
        scheduleMachineDrafts={scheduleMachineDrafts}
        editableRecordDrafts={editableRecordDrafts}
        editableRecordOptions={getEditableRecordOptions()}
        scheduleMachineOptions={scheduleMachineOptions}
        handleScheduleMachineDraftChange={handleScheduleMachineDraftChange}
        handleEditableRecordDraftChange={handleEditableRecordDraftChange}
        handleScheduleMachineUpdate={handleScheduleMachineUpdate}
        handleEditableRecordUpdate={handleEditableRecordUpdate}
        handleSchedulePrefill={handleSchedulePrefill}
        handleScheduleHighlight={handleScheduleHighlight}
        highlightedScheduleRecordId={highlightedScheduleRecordId}
        statusField={statusField}
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        setSearchTerm={setSearchTerm}
        setStatusFilter={setStatusFilter}
        visibleCount={visibleCount}
        handleExportScheduleImage={handleExportScheduleImage}
        handleExportScheduleMachinesImage={handleExportScheduleMachinesImage}
        handleExportMachineChecklistImage={handleExportMachineChecklistImage}
        handleExportDeliveredChangesImage={handleExportDeliveredChangesImage}
        handlePrintDeliveredChanges={handlePrintDeliveredChanges}
        handleExportClosedDeliveriesImage={handleExportClosedDeliveriesImage}
        handlePrintClosedDeliveries={handlePrintClosedDeliveries}
        handleExportPaidAdvancesImage={handleExportPaidAdvancesImage}
        handlePrintPaidAdvances={handlePrintPaidAdvances}
        handleExportBackup={handleExportBackup}
        handleManualReset={handleManualReset}
        handleClearAll={handleClearAll}
        tableColumns={tableColumns}
        handleMarkReturned={handleMarkReturned}
        freshRecordId={freshRecordId}
        highlightedRecordId={requestedRecordId || highlightedScheduleRecordId}
      />

      <NativeModuleExportCanvases
        routePath={route.path}
        scheduleImageRef={scheduleImageRef}
        scheduleMachinesImageRef={scheduleMachinesImageRef}
        machineChecklistImageRef={machineChecklistImageRef}
        changeDeliveredImageRef={changeDeliveredImageRef}
        deliveryReadingClosedImageRef={deliveryReadingClosedImageRef}
        advancesPaidImageRef={advancesPaidImageRef}
        visibleRecords={visibleRecords}
        usedScheduleMachines={usedScheduleMachines}
        metrics={metrics}
        formatChecklistDate={formatChecklistDate}
        formatCurrencyValue={formatCurrencyValue}
        session={session}
        presentMachineChecklistRecords={presentMachineChecklistRecords}
        deliveredChangeRecords={deliveredChangeRecords}
        deliveredChangeTotalValue={deliveredChangeTotalValue}
        deliveredChangeCourierCount={deliveredChangeCourierCount}
        closedDeliveryRecords={closedDeliveryRecords}
        closedDeliveryCourierCount={closedDeliveryCourierCount}
        paidAdvanceRecords={paidAdvanceRecords}
        paidAdvanceTotalValue={paidAdvanceTotalValue}
        paidAdvanceRecipientCount={paidAdvanceRecipientCount}
      />
    </div>
  )
}

export default NativeModuleWorkspace
