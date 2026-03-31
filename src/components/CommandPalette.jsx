import { useEffect, useMemo, useState } from 'react'

import { Button, Modal } from './ui'

function ShortcutBadge({ value }) {
  if (!value) {
    return null
  }

  return <span className="shortcut-badge">{value}</span>
}

function CommandRow({ command, onSelect }) {
  return (
    <button type="button" className="command-palette__item" onClick={() => onSelect(command.id)}>
      <span className="command-palette__item-copy">
        <strong>{command.label}</strong>
        <span>{command.description}</span>
      </span>
      <span className="command-palette__item-meta">
        <span className="command-palette__item-category">{command.category}</span>
        <ShortcutBadge value={command.shortcut} />
      </span>
    </button>
  )
}

function HelpSection({ section }) {
  return (
    <section className="command-palette__help-section">
      <h3>{section.category}</h3>
      <div className="command-palette__help-grid">
        {section.entries.map((entry) => (
          <div key={entry.id} className="command-palette__help-item">
            <div>
              <strong>{entry.label}</strong>
              <p>{entry.description}</p>
            </div>
            <ShortcutBadge value={entry.shortcut} />
          </div>
        ))}
      </div>
    </section>
  )
}

function CommandPalette({
  helpSections,
  isHelpOpen,
  isPaletteOpen,
  onCloseHelp,
  onClosePalette,
  onExecute,
  recentCommands,
  searchCommands,
}) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!isPaletteOpen) {
      setQuery('')
    }
  }, [isPaletteOpen])

  const visibleCommands = useMemo(() => {
    if (!isPaletteOpen) {
      return []
    }

    const filtered = searchCommands(query)

    if (query.trim()) {
      return filtered
    }

    const recentIds = new Set(recentCommands.map((command) => command.id))
    return [...recentCommands, ...filtered.filter((command) => !recentIds.has(command.id))].slice(
      0,
      12,
    )
  }, [isPaletteOpen, query, recentCommands, searchCommands])

  return (
    <>
      <Modal
        open={isPaletteOpen}
        title="Palette de comando"
        description="Busque acoes, telas e atalhos com resposta imediata."
        closeLabel="Fechar palette"
        initialFocusSelector="#command-palette-search"
        onClose={onClosePalette}
        footer={
          <div className="command-palette__footer">
            <span>Ctrl+K para abrir</span>
            <Button variant="secondary" onClick={onClosePalette}>
              Fechar
            </Button>
          </div>
        }
      >
        <div className="command-palette">
          <label className="ui-label" htmlFor="command-palette-search">
            Buscar comando
          </label>
          <input
            id="command-palette-search"
            className="ui-input"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pedidos, caixa, relatorios, salvar..."
            autoComplete="off"
          />

          {recentCommands.length ? (
            <div className="command-palette__meta">
              <span>Recentes: {recentCommands.map((command) => command.label).join(' · ')}</span>
            </div>
          ) : null}

          <div
            className="command-palette__results"
            role="listbox"
            aria-label="Comandos disponiveis"
          >
            {visibleCommands.map((command) => (
              <CommandRow key={command.id} command={command} onSelect={onExecute} />
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        open={isHelpOpen}
        title="Ajuda de atalhos"
        description="Mapa rapido dos atalhos globais e contextuais ativos para este terminal."
        closeLabel="Fechar ajuda"
        onClose={onCloseHelp}
        footer={
          <div className="command-palette__footer">
            <span>Personalize os atalhos em Sistema &gt; Configuracoes</span>
            <Button variant="secondary" onClick={onCloseHelp}>
              Fechar
            </Button>
          </div>
        }
      >
        <div className="command-palette command-palette--help">
          {helpSections.map((section) => (
            <HelpSection key={section.category} section={section} />
          ))}
        </div>
      </Modal>
    </>
  )
}

export default CommandPalette
