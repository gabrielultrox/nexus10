import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

const STORAGE_KEY = 'nexus-history-filters-v1'
const MAX_FILTER_CHIPS = 10

type THistoryChipType = 'dateRange' | 'module' | 'status' | 'operator' | 'value'

interface IDateRangeFilter {
  start: string
  end: string
}

interface IHistoricoFiltersState {
  dateRange: IDateRangeFilter
  module: string
  status: string
  operator: string
  value: string
  q: string
  day: string
  activeChips: THistoryChipType[]
}

type THistoryStateUpdater =
  | IHistoricoFiltersState
  | ((currentState: IHistoricoFiltersState) => IHistoricoFiltersState)

interface IToastLike {
  info?: (message: string) => void
  warning?: (message: string) => void
}

function getTodayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildDefaultState(): IHistoricoFiltersState {
  const todayKey = getTodayKey()

  return {
    dateRange: {
      start: todayKey,
      end: todayKey,
    },
    module: 'all',
    status: 'all',
    operator: '',
    value: '',
    q: '',
    day: todayKey,
    activeChips: ['dateRange', 'module', 'status'],
  }
}

function normalizeActiveChips(activeChips: THistoryChipType[] = []): THistoryChipType[] {
  return Array.from(new Set(activeChips)).slice(0, MAX_FILTER_CHIPS)
}

function parseDateRangeParam(value: string | null): IDateRangeFilter | null {
  if (!value) {
    return null
  }

  const [start = '', end = ''] = String(value).split(',')

  if (!start || !end) {
    return null
  }

  return { start, end }
}

function normalizeDateRange(dateRange: IDateRangeFilter | null): IDateRangeFilter | null {
  if (!dateRange?.start || !dateRange?.end) {
    return dateRange
  }

  if (dateRange.start <= dateRange.end) {
    return dateRange
  }

  return {
    start: dateRange.end,
    end: dateRange.start,
  }
}

function parseStoredState(): Partial<IHistoricoFiltersState> | null {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)

    if (!rawValue) {
      return null
    }

    return JSON.parse(rawValue)
  } catch {
    return null
  }
}

function buildStateFromSearchParams(searchParams: URLSearchParams): IHistoricoFiltersState {
  const defaults = buildDefaultState()
  const legacyDay = searchParams.get('data')
  const legacyModule = searchParams.get('modulo')
  const legacyStatus = searchParams.get('tipo')
  const dateRange =
    normalizeDateRange(
      parseDateRangeParam(searchParams.get('dateRange')) ??
        (legacyDay && legacyDay !== 'hoje'
          ? { start: legacyDay, end: legacyDay }
          : { start: defaults.dateRange.start, end: defaults.dateRange.end }),
    ) ?? defaults.dateRange

  return {
    dateRange,
    module: searchParams.get('module') ?? legacyModule ?? defaults.module,
    status: searchParams.get('status') ?? legacyStatus ?? defaults.status,
    operator: searchParams.get('operator') ?? '',
    value: searchParams.get('value') ?? '',
    q: searchParams.get('q') ?? '',
    day: searchParams.get('day') ?? legacyDay ?? dateRange.end,
    activeChips: normalizeActiveChips(
      (searchParams.get('chips') ?? '')
        .split(',')
        .map((chip) => chip.trim())
        .filter(Boolean) as THistoryChipType[],
    ),
  }
}

function buildHasMeaningfulParams(searchParams: URLSearchParams) {
  return [
    'dateRange',
    'module',
    'status',
    'operator',
    'value',
    'q',
    'day',
    'chips',
    'modulo',
    'tipo',
    'data',
  ].some((key) => searchParams.has(key))
}

function serializeState(state: IHistoricoFiltersState) {
  const nextParams = new URLSearchParams()

  nextParams.set('dateRange', `${state.dateRange.start},${state.dateRange.end}`)
  nextParams.set('day', state.day)
  nextParams.set('chips', normalizeActiveChips(state.activeChips).join(','))

  if (state.module && state.module !== 'all') {
    nextParams.set('module', state.module)
  }

  if (state.status && state.status !== 'all') {
    nextParams.set('status', state.status)
  }

  if (state.operator) {
    nextParams.set('operator', state.operator)
  }

  if (state.value) {
    nextParams.set('value', state.value)
  }

  if (state.q) {
    nextParams.set('q', state.q)
  }

  return nextParams
}

export function useHistoricoFilters(toast?: IToastLike) {
  const [searchParams, setSearchParams] = useSearchParams()
  const hasMeaningfulParams = useMemo(() => buildHasMeaningfulParams(searchParams), [searchParams])

  useEffect(() => {
    if (hasMeaningfulParams) {
      return
    }

    const storedState = parseStoredState()

    if (!storedState) {
      return
    }

    setSearchParams(serializeState({ ...buildDefaultState(), ...storedState }), { replace: true })
  }, [hasMeaningfulParams, setSearchParams])

  const state = useMemo(
    () =>
      hasMeaningfulParams
        ? buildStateFromSearchParams(searchParams)
        : {
            ...buildDefaultState(),
          },
    [hasMeaningfulParams, searchParams],
  )

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const updateState = useCallback(
    (updater: THistoryStateUpdater) => {
      const currentState = buildStateFromSearchParams(searchParams)
      const nextState =
        typeof updater === 'function' ? updater(currentState) : { ...currentState, ...updater }

      setSearchParams(serializeState(nextState), { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const addChip = useCallback(
    (chipType: THistoryChipType) => {
      if (!chipType) {
        return
      }

      if (state.activeChips.includes(chipType)) {
        toast?.info?.('Esse filtro ja esta ativo.')
        return
      }

      if (state.activeChips.length >= MAX_FILTER_CHIPS) {
        toast?.warning?.('Limite de 10 filtros ativos atingido.')
        return
      }

      updateState((currentState) => ({
        ...currentState,
        activeChips: normalizeActiveChips([...currentState.activeChips, chipType]),
      }))
    },
    [state.activeChips, toast, updateState],
  )

  const removeChip = useCallback(
    (chipType: THistoryChipType) => {
      updateState((currentState) => {
        const nextState = {
          ...currentState,
          activeChips: currentState.activeChips.filter((chip) => chip !== chipType),
        }

        if (chipType === 'module') {
          nextState.module = 'all'
        }

        if (chipType === 'status') {
          nextState.status = 'all'
        }

        if (chipType === 'operator') {
          nextState.operator = ''
        }

        if (chipType === 'value') {
          nextState.value = ''
        }

        if (chipType === 'dateRange') {
          const defaults = buildDefaultState()
          nextState.dateRange = defaults.dateRange
          nextState.day = defaults.day
        }

        return nextState
      })
    },
    [updateState],
  )

  const setFilterValue = useCallback(
    (chipType: THistoryChipType, value: string | IDateRangeFilter) => {
      updateState((currentState) => {
        if (chipType === 'dateRange') {
          const typedValue = value as IDateRangeFilter
          const nextRange = normalizeDateRange({
            start: typedValue.start || currentState.dateRange.start,
            end: typedValue.end || currentState.dateRange.end,
          })

          return {
            ...currentState,
            dateRange: nextRange ?? currentState.dateRange,
            day:
              currentState.day >= (nextRange?.start ?? currentState.dateRange.start) &&
              currentState.day <= (nextRange?.end ?? currentState.dateRange.end)
                ? currentState.day
                : (nextRange?.end ?? currentState.dateRange.end),
          }
        }

        return {
          ...currentState,
          [chipType]: value as string,
        }
      })
    },
    [updateState],
  )

  const setDay = useCallback(
    (day: string) => {
      updateState((currentState) => ({
        ...currentState,
        day,
      }))
    },
    [updateState],
  )

  const setSearchQuery = useCallback(
    (q: string) => {
      updateState((currentState) => ({
        ...currentState,
        q,
      }))
    },
    [updateState],
  )

  return {
    filters: state,
    addChip,
    removeChip,
    setFilterValue,
    setDay,
    setSearchQuery,
    maxChips: MAX_FILTER_CHIPS,
  }
}

export default useHistoricoFilters
