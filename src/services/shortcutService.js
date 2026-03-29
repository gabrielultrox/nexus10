export const SHORTCUTS_STORAGE_KEY = 'nexus10.shortcuts.preferences'
export const SHORTCUTS_RECENTS_STORAGE_KEY = 'nexus10.shortcuts.recents'
export const SHORTCUTS_UPDATED_EVENT = 'nexus10:shortcuts-updated'
export const SHORTCUT_ACTION_EVENT = 'nexus10:shortcut-action'
export const MAX_SHORTCUT_RECENTS = 8

export const SHORTCUT_DEFINITIONS = [
  {
    id: 'new-order',
    label: 'Novo pedido',
    description: 'Abre o fluxo de criacao de pedido.',
    category: 'Globais',
    defaultShortcut: 'Ctrl+N',
  },
  {
    id: 'print',
    label: 'Imprimir',
    description: 'Dispara impressao ou comprovante da tela atual.',
    category: 'Globais',
    defaultShortcut: 'Ctrl+P',
  },
  {
    id: 'save',
    label: 'Salvar',
    description: 'Salva o formulario ou confirma a acao atual.',
    category: 'Globais',
    defaultShortcut: 'Ctrl+S',
  },
  {
    id: 'undo',
    label: 'Desfazer',
    description: 'Solicita desfazer a ultima acao suportada.',
    category: 'Globais',
    defaultShortcut: 'Ctrl+Z',
  },
  {
    id: 'redo',
    label: 'Refazer',
    description: 'Solicita refazer a ultima acao suportada.',
    category: 'Globais',
    defaultShortcut: 'Ctrl+Y',
  },
  {
    id: 'command-palette',
    label: 'Palette de comando',
    description: 'Abre a busca rapida de acoes e rotas.',
    category: 'Globais',
    defaultShortcut: 'Ctrl+K',
  },
  {
    id: 'show-help',
    label: 'Ajuda de atalhos',
    description: 'Mostra o guia de atalhos disponiveis.',
    category: 'Globais',
    defaultShortcut: 'Ctrl+?',
  },
  {
    id: 'orders-confirm',
    label: 'Confirmar em pedidos',
    description: 'Confirma a acao principal da tela de pedidos.',
    category: 'Pedidos',
    defaultShortcut: 'Enter',
  },
  {
    id: 'orders-delete',
    label: 'Excluir em pedidos',
    description: 'Solicita exclusao do pedido em foco.',
    category: 'Pedidos',
    defaultShortcut: 'Delete',
  },
  {
    id: 'cash-opening',
    label: 'Abertura de caixa',
    description: 'Vai direto para a aba de abertura de caixa.',
    category: 'Caixa',
    defaultShortcut: 'Ctrl+A',
  },
  {
    id: 'cash-closing',
    label: 'Fechamento de caixa',
    description: 'Vai direto para a aba de fechamento de caixa.',
    category: 'Caixa',
    defaultShortcut: 'Ctrl+F',
  },
  {
    id: 'cancel',
    label: 'Cancelar',
    description: 'Fecha dialogos ou cancela a acao em andamento.',
    category: 'Contextuais',
    defaultShortcut: 'Escape',
  },
]

const SHORTCUT_KEYS = new Set(['Ctrl', 'Alt', 'Shift'])

function safeWindow() {
  return typeof window !== 'undefined' ? window : null
}

export function getDefaultShortcuts() {
  return SHORTCUT_DEFINITIONS.reduce((accumulator, definition) => {
    accumulator[definition.id] = definition.defaultShortcut
    return accumulator
  }, {})
}

export function normalizeShortcut(shortcut) {
  if (!shortcut || typeof shortcut !== 'string') {
    return ''
  }

  const normalizedTokens = shortcut
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const lowerToken = token.toLowerCase()

      if (lowerToken === 'cmd' || lowerToken === 'meta' || lowerToken === 'control') {
        return 'Ctrl'
      }

      if (lowerToken === 'option') {
        return 'Alt'
      }

      if (lowerToken === 'esc') {
        return 'Escape'
      }

      if (lowerToken === 'del') {
        return 'Delete'
      }

      if (lowerToken === 'space') {
        return 'Space'
      }

      if (lowerToken === '?') {
        return '?'
      }

      if (lowerToken.length === 1) {
        return lowerToken.toUpperCase()
      }

      return lowerToken.charAt(0).toUpperCase() + lowerToken.slice(1)
    })

  const modifiers = ['Ctrl', 'Alt', 'Shift'].filter((modifier) =>
    normalizedTokens.includes(modifier),
  )
  const keyToken = normalizedTokens.find((token) => !SHORTCUT_KEYS.has(token)) ?? ''

  return [...modifiers, keyToken].filter(Boolean).join('+')
}

export function keyboardEventToShortcut(event) {
  if (!event) {
    return ''
  }

  const modifiers = []

  if (event.ctrlKey || event.metaKey) {
    modifiers.push('Ctrl')
  }

  if (event.altKey) {
    modifiers.push('Alt')
  }

  if (event.shiftKey) {
    modifiers.push('Shift')
  }

  let key = event.key ?? ''

  if (key === ' ') {
    key = 'Space'
  } else if (key === '/') {
    key = event.shiftKey ? '?' : '/'
  } else if (key.length === 1) {
    key = key.toUpperCase()
  }

  return normalizeShortcut([...modifiers, key].filter(Boolean).join('+'))
}

export function loadShortcutPreferences() {
  const defaults = getDefaultShortcuts()
  const runtime = safeWindow()

  if (!runtime) {
    return defaults
  }

  try {
    const saved = runtime.localStorage.getItem(SHORTCUTS_STORAGE_KEY)

    if (!saved) {
      return defaults
    }

    const parsed = JSON.parse(saved)
    const next = { ...defaults }

    for (const [actionId, shortcut] of Object.entries(parsed ?? {})) {
      next[actionId] = normalizeShortcut(String(shortcut))
    }

    return next
  } catch {
    return defaults
  }
}

export function saveShortcutPreferences(nextPreferences) {
  const runtime = safeWindow()
  const normalized = Object.entries(nextPreferences ?? {}).reduce(
    (accumulator, [actionId, value]) => {
      accumulator[actionId] = normalizeShortcut(String(value ?? ''))
      return accumulator
    },
    {},
  )

  if (runtime) {
    runtime.localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(normalized))
    runtime.dispatchEvent(
      new CustomEvent(SHORTCUTS_UPDATED_EVENT, {
        detail: normalized,
      }),
    )
  }

  return normalized
}

export function updateShortcutPreference(actionId, shortcut) {
  const nextPreferences = {
    ...loadShortcutPreferences(),
    [actionId]: normalizeShortcut(shortcut),
  }

  return saveShortcutPreferences(nextPreferences)
}

export function resetShortcutPreferences() {
  return saveShortcutPreferences(getDefaultShortcuts())
}

export function findShortcutConflict(actionId, shortcut, preferences = loadShortcutPreferences()) {
  const normalizedShortcut = normalizeShortcut(shortcut)

  if (!normalizedShortcut) {
    return null
  }

  return SHORTCUT_DEFINITIONS.find(
    (definition) =>
      definition.id !== actionId &&
      normalizeShortcut(preferences[definition.id]) === normalizedShortcut,
  )
}

export function loadRecentShortcutActions() {
  const runtime = safeWindow()

  if (!runtime) {
    return []
  }

  try {
    const saved = runtime.localStorage.getItem(SHORTCUTS_RECENTS_STORAGE_KEY)
    const parsed = saved ? JSON.parse(saved) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function recordRecentShortcutAction(actionId) {
  const runtime = safeWindow()

  if (!runtime || !actionId) {
    return []
  }

  const current = loadRecentShortcutActions()
  const next = [actionId, ...current.filter((entry) => entry !== actionId)].slice(
    0,
    MAX_SHORTCUT_RECENTS,
  )

  runtime.localStorage.setItem(SHORTCUTS_RECENTS_STORAGE_KEY, JSON.stringify(next))
  return next
}

export function getShortcutDefinition(actionId) {
  return SHORTCUT_DEFINITIONS.find((definition) => definition.id === actionId) ?? null
}

export function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  const tagName = target.tagName.toLowerCase()
  return ['input', 'textarea', 'select'].includes(tagName)
}

export function dispatchShortcutAction(actionId, detail = {}) {
  const runtime = safeWindow()

  if (!runtime) {
    return true
  }

  const shortcutEvent = new CustomEvent(SHORTCUT_ACTION_EVENT, {
    detail: {
      actionId,
      ...detail,
    },
    cancelable: true,
  })

  return runtime.dispatchEvent(shortcutEvent)
}

export function getShortcutLabel(actionId, preferences = loadShortcutPreferences()) {
  return normalizeShortcut(preferences[actionId] ?? '')
}
