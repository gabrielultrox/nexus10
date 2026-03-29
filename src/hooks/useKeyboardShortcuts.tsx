import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from './useAuth'
import { useToast } from './useToast'
import { routeDefinitions } from '../utils/routeCatalog'
import {
  SHORTCUT_DEFINITIONS,
  SHORTCUTS_UPDATED_EVENT,
  dispatchShortcutAction,
  findShortcutConflict,
  getShortcutLabel,
  isEditableTarget,
  keyboardEventToShortcut,
  loadRecentShortcutActions,
  loadShortcutPreferences,
  normalizeShortcut,
  recordRecentShortcutAction,
  resetShortcutPreferences,
  saveShortcutPreferences,
  updateShortcutPreference,
} from '../services/shortcutService'

interface UseKeyboardShortcutsOptions {
  enabled?: boolean
}

function isActionAllowedInsideEditable(actionId: string) {
  return ['command-palette', 'show-help', 'cancel', 'save'].includes(actionId)
}

function isBrowserReservedConflict(actionId: string, event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey)) {
    return false
  }

  return ['new-order', 'print'].includes(actionId)
}

function openFirstAvailableForm() {
  const form = document.querySelector(
    'form:not([data-shortcut-ignore="true"])',
  ) as HTMLFormElement | null

  if (!form) {
    return false
  }

  form.requestSubmit()
  return true
}

function triggerCancelTarget() {
  const target = document.querySelector(
    '[data-shortcut-cancel="true"], .ui-modal__close, [aria-label="Fechar"]',
  ) as HTMLElement | null

  if (!target) {
    return false
  }

  target.click()
  return true
}

function clickShortcutTarget(selectors: string[]) {
  for (const selector of selectors) {
    const target = document.querySelector(selector) as HTMLElement | null

    if (target) {
      target.click()
      return true
    }
  }

  return false
}

function scoreCommand(query: string, haystack: string) {
  if (!query) {
    return 0
  }

  const normalizedQuery = query.toLowerCase()
  const normalizedText = haystack.toLowerCase()

  if (normalizedText.includes(normalizedQuery)) {
    return normalizedQuery.length * 10
  }

  let score = 0
  let currentIndex = 0

  for (const character of normalizedQuery) {
    const nextIndex = normalizedText.indexOf(character, currentIndex)

    if (nextIndex === -1) {
      return -1
    }

    score += 2
    currentIndex = nextIndex + 1
  }

  return score
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { enabled = true } = options
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const { hasRole } = useAuth()
  const [shortcutMap, setShortcutMap] = useState<Record<string, string>>(() =>
    loadShortcutPreferences(),
  )
  const [recentActionIds, setRecentActionIds] = useState<string[]>(() =>
    loadRecentShortcutActions(),
  )
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  const routeCommands = useMemo(
    () =>
      routeDefinitions
        .filter((route) => !route.hiddenInSidebar && hasRole(route.requiredRoles))
        .map((route) => ({
          id: `route:${route.path}`,
          label: route.label,
          description: route.description,
          category: route.section,
          path: `/${route.path}`,
          shortcut: '',
        })),
    [hasRole],
  )

  const actionCommands = useMemo(
    () =>
      SHORTCUT_DEFINITIONS.map((definition) => ({
        id: definition.id,
        label: definition.label,
        description: definition.description,
        category: definition.category,
        shortcut: getShortcutLabel(definition.id, shortcutMap),
      })),
    [shortcutMap],
  )

  const commands = useMemo(
    () => [...actionCommands, ...routeCommands],
    [actionCommands, routeCommands],
  )

  const recentCommands = useMemo(
    () =>
      recentActionIds
        .map((actionId) => commands.find((command) => command.id === actionId))
        .filter(Boolean),
    [commands, recentActionIds],
  )

  const helpSections = useMemo(() => {
    const grouped = new Map<string, Array<(typeof actionCommands)[number]>>()

    for (const command of actionCommands) {
      if (!grouped.has(command.category)) {
        grouped.set(command.category, [])
      }

      grouped.get(command.category)?.push(command)
    }

    return Array.from(grouped.entries()).map(([category, entries]) => ({
      category,
      entries,
    }))
  }, [actionCommands])

  const executeCommand = useCallback(
    (commandId: string, options?: { recordRecent?: boolean }) => {
      const shouldRecord = options?.recordRecent !== false

      if (commandId.startsWith('route:')) {
        const routePath = commandId.slice('route:'.length)
        navigate(`/${routePath}`)
        if (shouldRecord) {
          setRecentActionIds(recordRecentShortcutAction(commandId))
        }
        return true
      }

      if (shouldRecord) {
        setRecentActionIds(recordRecentShortcutAction(commandId))
      }

      switch (commandId) {
        case 'command-palette':
          setIsHelpOpen(false)
          setIsPaletteOpen(true)
          return true
        case 'show-help':
          setIsPaletteOpen(false)
          setIsHelpOpen(true)
          return true
        case 'new-order':
          navigate('/orders/new')
          return true
        case 'print': {
          const wasHandled = dispatchShortcutAction(commandId, {
            pathname: location.pathname,
          })

          if (wasHandled) {
            window.print()
          }

          return true
        }
        case 'save': {
          const wasHandled = dispatchShortcutAction(commandId, {
            pathname: location.pathname,
          })

          if (wasHandled) {
            return openFirstAvailableForm()
          }

          return true
        }
        case 'cancel': {
          const wasHandled = dispatchShortcutAction(commandId, {
            pathname: location.pathname,
          })

          if (isPaletteOpen) {
            setIsPaletteOpen(false)
          }

          if (isHelpOpen) {
            setIsHelpOpen(false)
          }

          if (wasHandled) {
            triggerCancelTarget()
          }

          return true
        }
        case 'undo':
        case 'redo':
          dispatchShortcutAction(commandId, {
            pathname: location.pathname,
          })
          return true
        case 'orders-confirm':
        case 'cash-opening':
        case 'cash-closing':
          dispatchShortcutAction(commandId, {
            pathname: location.pathname,
          })
          return true
        case 'orders-delete': {
          const wasHandled = dispatchShortcutAction(commandId, {
            pathname: location.pathname,
          })

          if (wasHandled) {
            clickShortcutTarget(['.orders-domain__delete-button', '[aria-label^="Excluir pedido"]'])
          }

          return true
        }
        default:
          return false
      }
    },
    [isHelpOpen, isPaletteOpen, location.pathname, navigate],
  )

  useEffect(() => {
    function handleStorageUpdate(event: Event) {
      const customEvent = event as CustomEvent<Record<string, string>>
      setShortcutMap(customEvent.detail ?? loadShortcutPreferences())
    }

    window.addEventListener(SHORTCUTS_UPDATED_EVENT, handleStorageUpdate)
    return () => {
      window.removeEventListener(SHORTCUTS_UPDATED_EVENT, handleStorageUpdate)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    function handleKeyDown(event: KeyboardEvent) {
      const actionEntry = SHORTCUT_DEFINITIONS.find((definition) => {
        const expected = normalizeShortcut(shortcutMap[definition.id] ?? definition.defaultShortcut)
        const received = keyboardEventToShortcut(event)
        return expected && expected === received
      })

      if (!actionEntry) {
        return
      }

      if (actionEntry.id === 'orders-confirm' && !location.pathname.startsWith('/orders')) {
        return
      }

      if (actionEntry.id === 'orders-delete' && !location.pathname.startsWith('/orders')) {
        return
      }

      if (
        ['cash-opening', 'cash-closing'].includes(actionEntry.id) &&
        !location.pathname.startsWith('/cash')
      ) {
        return
      }

      const editableTarget = isEditableTarget(event.target)

      if (editableTarget && !isActionAllowedInsideEditable(actionEntry.id)) {
        return
      }

      if (isBrowserReservedConflict(actionEntry.id, event) && editableTarget) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const didExecute = executeCommand(actionEntry.id)

      if (!didExecute) {
        toast.info('Atalho sem acao vinculada.')
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [enabled, executeCommand, location.pathname, shortcutMap, toast])

  const searchCommands = useCallback(
    (query: string) => {
      const normalizedQuery = query.trim()

      if (!normalizedQuery) {
        return commands
      }

      return commands
        .map((command) => ({
          command,
          score: scoreCommand(
            normalizedQuery,
            `${command.label} ${command.description} ${command.category} ${command.shortcut}`,
          ),
        }))
        .filter((entry) => entry.score >= 0)
        .sort((left, right) => right.score - left.score)
        .map((entry) => entry.command)
    },
    [commands],
  )

  const updateShortcut = useCallback(
    (actionId: string, nextShortcut: string) => {
      const normalized = normalizeShortcut(nextShortcut)
      const nextPreferences = {
        ...shortcutMap,
        [actionId]: normalized,
      }

      const conflict = findShortcutConflict(actionId, normalized, nextPreferences)

      if (conflict) {
        return {
          ok: false,
          message: `Conflito com ${conflict.label}.`,
        }
      }

      const saved = updateShortcutPreference(actionId, normalized)
      setShortcutMap(saved)
      return {
        ok: true,
        message: 'Atalho atualizado.',
      }
    },
    [shortcutMap],
  )

  const replaceShortcuts = useCallback((nextPreferences: Record<string, string>) => {
    const saved = saveShortcutPreferences(nextPreferences)
    setShortcutMap(saved)
    return saved
  }, [])

  const restoreDefaults = useCallback(() => {
    const saved = resetShortcutPreferences()
    setShortcutMap(saved)
    return saved
  }, [])

  return {
    commands,
    helpSections,
    isHelpOpen,
    isPaletteOpen,
    recentCommands,
    recentActionIds,
    searchCommands,
    shortcutMap,
    closeHelp() {
      setIsHelpOpen(false)
    },
    closePalette() {
      setIsPaletteOpen(false)
    },
    executeCommand,
    openHelp() {
      setIsPaletteOpen(false)
      setIsHelpOpen(true)
    },
    openPalette() {
      setIsHelpOpen(false)
      setIsPaletteOpen(true)
    },
    replaceShortcuts,
    restoreDefaults,
    updateShortcut,
  }
}
