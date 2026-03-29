import { useMemo, useState } from 'react'

import { Button } from '../../components/ui'
import {
  SHORTCUT_DEFINITIONS,
  getDefaultShortcuts,
  keyboardEventToShortcut,
  loadShortcutPreferences,
  resetShortcutPreferences,
  saveShortcutPreferences,
} from '../../services/shortcutService'

function ShortcutCaptureInput({ actionId, disabled, onCapture, value }) {
  return (
    <input
      id={`shortcut-${actionId}`}
      className="ui-input keyboard-settings__capture"
      type="text"
      value={value}
      disabled={disabled}
      readOnly
      onKeyDown={(event) => {
        event.preventDefault()

        if (event.key === 'Backspace' || event.key === 'Delete') {
          onCapture('')
          return
        }

        const nextShortcut = keyboardEventToShortcut(event)

        if (!nextShortcut) {
          return
        }

        onCapture(nextShortcut)
      }}
      placeholder="Pressione o atalho"
      title="Clique e pressione a combinacao desejada"
    />
  )
}

function KeyboardSettings({ canWriteSettings = false, onShortcutUpdate = null }) {
  const [shortcutMap, setShortcutMap] = useState(() => loadShortcutPreferences())
  const [feedback, setFeedback] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const sections = useMemo(() => {
    const groups = new Map()

    for (const definition of SHORTCUT_DEFINITIONS) {
      if (!groups.has(definition.category)) {
        groups.set(definition.category, [])
      }

      groups.get(definition.category).push(definition)
    }

    return Array.from(groups.entries()).map(([category, entries]) => ({
      category,
      entries,
    }))
  }, [])

  function persist(nextMap, successMessage) {
    setShortcutMap(nextMap)
    saveShortcutPreferences(nextMap)
    onShortcutUpdate?.(nextMap)
    setFeedback(successMessage)
    setErrorMessage('')
  }

  function handleCapture(actionId, nextShortcut) {
    if (!canWriteSettings) {
      setErrorMessage('Seu perfil nao pode alterar atalhos.')
      return
    }

    const conflict = SHORTCUT_DEFINITIONS.find(
      (definition) =>
        definition.id !== actionId && shortcutMap[definition.id] === nextShortcut && nextShortcut,
    )

    if (conflict) {
      setErrorMessage(`Conflito com ${conflict.label}.`)
      setFeedback('')
      return
    }

    persist(
      {
        ...shortcutMap,
        [actionId]: nextShortcut,
      },
      'Atalho atualizado.',
    )
  }

  function handleResetAction(actionId) {
    const defaults = getDefaultShortcuts()

    persist(
      {
        ...shortcutMap,
        [actionId]: defaults[actionId] ?? '',
      },
      'Atalho restaurado para o padrao.',
    )
  }

  function handleResetAll() {
    const defaults = resetShortcutPreferences()
    setShortcutMap(defaults)
    onShortcutUpdate?.(defaults)
    setFeedback('Todos os atalhos voltaram ao padrao.')
    setErrorMessage('')
  }

  return (
    <section className="settings-section">
      <header className="settings-section__header">
        <div className="settings-section__copy">
          <p className="settings-section-kicker">Produtividade</p>
          <h2 className="settings-section__title">Atalhos de teclado</h2>
          <p className="settings-section__description">
            Ajuste os atalhos globais e contextuais do terminal. Clique em um campo e pressione a
            combinacao desejada.
          </p>
        </div>
      </header>

      <div className="settings-grid">
        <div className="keyboard-settings__panel">
          <div className="keyboard-settings__meta">
            <span>Escopo</span>
            <strong>Global + contextual</strong>
          </div>
          <div className="keyboard-settings__meta">
            <span>Persistencia</span>
            <strong>localStorage por terminal</strong>
          </div>
          <div className="keyboard-settings__actions">
            <Button
              variant="secondary"
              type="button"
              onClick={handleResetAll}
              disabled={!canWriteSettings}
            >
              Restaurar padrao
            </Button>
          </div>
        </div>

        <div className="keyboard-settings__groups">
          {sections.map((section) => (
            <article key={section.category} className="keyboard-settings__group">
              <header className="keyboard-settings__group-header">
                <h3>{section.category}</h3>
              </header>

              <div className="keyboard-settings__list">
                {section.entries.map((entry) => (
                  <div key={entry.id} className="keyboard-settings__row">
                    <div className="keyboard-settings__copy">
                      <strong>{entry.label}</strong>
                      <p>{entry.description}</p>
                    </div>
                    <div className="keyboard-settings__controls">
                      <ShortcutCaptureInput
                        actionId={entry.id}
                        disabled={!canWriteSettings}
                        value={shortcutMap[entry.id] ?? ''}
                        onCapture={(nextShortcut) => handleCapture(entry.id, nextShortcut)}
                      />
                      <button
                        type="button"
                        className="ui-button ui-button--ghost"
                        onClick={() => handleResetAction(entry.id)}
                        disabled={!canWriteSettings}
                        title={`Restaurar ${entry.defaultShortcut}`}
                      >
                        Padrao
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        {feedback ? <div className="auth-error auth-error--success">{feedback}</div> : null}
        {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}
      </div>
    </section>
  )
}

export default KeyboardSettings
