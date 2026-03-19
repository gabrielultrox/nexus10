import { useEffect, useRef, useState } from 'react'

import SurfaceCard from '../../../components/common/SurfaceCard'

const ROW_EXIT_DURATION_MS = 200

function getStatusBadgeClass(value) {
  const normalized = String(value ?? '').trim().toLowerCase()

  if (
    normalized.includes('retorn') ||
    normalized.includes('conclu') ||
    normalized.includes('retornou') ||
    normalized.includes('validado') ||
    normalized.includes('fechada') ||
    normalized.includes('baixado') ||
    normalized.includes('confirmado') ||
    normalized.includes('ativo')
  ) {
    return 'ui-badge--success'
  }

  if (
    normalized.includes('cancel') ||
    normalized.includes('negad') ||
    normalized.includes('erro') ||
    normalized.includes('manutencao')
  ) {
    return 'ui-badge--danger'
  }

  if (
    normalized.includes('pend') ||
    normalized.includes('fila') ||
    normalized.includes('reserva') ||
    normalized.includes('aberto')
  ) {
    return 'ui-badge--warning'
  }

  return 'ui-badge--info'
}

function renderNativeModuleCell(column, cell, index) {
  const normalizedColumn = String(column ?? '').toLowerCase()
  const normalizedValue = String(cell ?? '').toLowerCase()

  if (normalizedColumn.includes('status') || normalizedColumn.includes('estado') || normalizedColumn.includes('presenca')) {
    return <span className={`ui-badge ${getStatusBadgeClass(cell)}`}>{cell}</span>
  }

  if (normalizedColumn.includes('valor')) {
    return <span className="ui-table__cell--numeric ui-table__cell--strong">{cell}</span>
  }

  if (normalizedColumn.includes('destino') || normalizedColumn.includes('retorno') || normalizedColumn.includes('atualizacao')) {
    return <span className="ui-table__cell--muted">{cell}</span>
  }

  if (index === 0) {
    return <span className="ui-table__cell--strong">{cell}</span>
  }

  if (normalizedValue.includes('sem atualizacao') || normalizedValue.includes('aguardando retorno')) {
    return <span className="ui-table__cell--muted">{cell}</span>
  }

  return cell
}

function ModuleEmptyState({ message }) {
  return (
    <div className="module-empty-state native-module__empty-state">
      <p className="module-empty-state__text">{message}</p>
    </div>
  )
}

function getPrefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getExitDuration() {
  return getPrefersReducedMotion() ? 0 : ROW_EXIT_DURATION_MS
}

function NativeModuleToolbar({
  routePath,
  manager,
  statusField,
  searchTerm,
  statusFilter,
  setSearchTerm,
  setStatusFilter,
  visibleCount,
  recordsLength,
  onExportSchedule,
  onExportScheduleMachines,
  onExportMachines,
  onExportBackup,
  onManualReset,
  onClearAll,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) {
      return undefined
    }

    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuOpen])

  if (!manager || manager.hideToolbar) {
    return null
  }

  return (
    <div className="native-module__toolbar">
      <div className="native-module__toolbar-primary">
        <div className="ui-field">
          <label className="ui-label" htmlFor={`${routePath}-search`}>
            Buscar
          </label>
          <input
            id={`${routePath}-search`}
            className="ui-input"
            type="text"
            value={searchTerm}
            placeholder={routePath === 'machines' ? 'Dispositivo, entregador ou modelo' : 'Buscar nos registros'}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        {statusField ? (
          <div className="ui-field">
            <label className="ui-label" htmlFor={`${routePath}-status-filter`}>
              Filtrar status
            </label>
            <select
              id={`${routePath}-status-filter`}
              className="ui-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Todos</option>
              {statusField.options.map((option) => (
                <option key={`${routePath}-status-${option}`} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="native-module__toolbar-secondary">
        <div className="native-module__toolbar-summary">
          <span className="ui-badge ui-badge--special">{visibleCount} visiveis</span>
          <span className="native-module__toolbar-summary-text">
            {recordsLength} registro{recordsLength === 1 ? '' : 's'} no dia
          </span>
        </div>

        <div className="native-module__toolbar-actions">
          {routePath === 'schedule' ? (
            <div className="native-module__toolbar-menu" ref={menuRef}>
              <button type="button" className="ui-button ui-button--ghost" onClick={onExportSchedule}>
                Exportar escala
              </button>
              <button
                type="button"
                className="native-module__toolbar-more"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Mais acoes"
                onClick={() => setMenuOpen((current) => !current)}
              >
                ⋯
              </button>

              {menuOpen ? (
                <div className="native-module__toolbar-dropdown" role="menu">
                  <button
                    type="button"
                    className="native-module__toolbar-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      onExportScheduleMachines()
                    }}
                  >
                    Exportar maquininhas usadas
                  </button>
                  <button
                    type="button"
                    className="native-module__toolbar-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      onExportBackup()
                    }}
                  >
                    Exportar backup
                  </button>
                  {manager.manualResetLabel ? (
                    <button
                      type="button"
                      className="native-module__toolbar-dropdown-item native-module__toolbar-dropdown-item--danger"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false)
                        onManualReset()
                      }}
                    >
                      {manager.manualResetLabel}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {routePath === 'machines' ? (
            <button type="button" className="ui-button ui-button--secondary" onClick={onExportMachines}>
              Exportar presentes
            </button>
          ) : null}
          {routePath !== 'schedule' ? (
            <button type="button" className="ui-button ui-button--ghost" onClick={onExportBackup}>
              Exportar backup
            </button>
          ) : null}
          {manager.manualResetLabel && routePath !== 'schedule' ? (
            <button type="button" className="ui-button ui-button--ghost" onClick={onManualReset}>
              {manager.manualResetLabel}
            </button>
          ) : null}
          {recordsLength > 0 && manager.allowClearAll !== false ? (
            <button type="button" className="ui-button ui-button--ghost" onClick={onClearAll}>
              Limpar tudo
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function NativeModuleMachineHistory({ groups }) {
  return (
    <div className="machine-history">
      <div className="machine-history__layout">
        <aside className="machine-history__calendar">
          <p className="machine-history__calendar-title">
            {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date())}
          </p>
          <div className="machine-history__calendar-grid">
            {Array.from({ length: 31 }, (_, index) => {
              const day = String(index + 1).padStart(2, '0')
              const month = String(new Date().getMonth() + 1).padStart(2, '0')
              const year = String(new Date().getFullYear())
              const dayKey = `${year}-${month}-${day}`
              const hasEntry = groups.some((group) => group.dayKey === dayKey)

              return (
                <span
                  key={dayKey}
                  className={`machine-history__day ${hasEntry ? 'machine-history__day--active' : ''}`}
                >
                  {index + 1}
                </span>
              )
            })}
          </div>
          <span className="machine-history__legend">Com registros</span>
        </aside>

        <div className="machine-history__content">
          {groups.length === 0 ? (
            <ModuleEmptyState message="Nenhum historico encontrado" />
          ) : (
            groups.map((group) => (
              <section key={group.dayKey} className="machine-history__day-group">
                <header className="machine-history__day-header">
                  <strong>{group.dayLabel}</strong>
                  <span>{group.entries.length} registros</span>
                </header>
                <div className="machine-history__entries">
                  {group.entries.map((entry) => (
                    <article key={entry.id} className="machine-history__entry">
                      <strong className="machine-history__entry-device">{entry.device}</strong>
                      <div>
                        <p className="machine-history__entry-actor">{entry.actor}</p>
                        <p className="machine-history__entry-action">{entry.action}</p>
                      </div>
                      <span className="machine-history__entry-time">{entry.time}</span>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function NativeModuleDeliveryReading({
  openRecords,
  closedRecords,
  recentlyClosedRecordId,
  formatAuditText,
  onApplyAction,
  onDelete,
  exitingIds,
}) {
  return (
    <div className="delivery-reading">
      <div className="delivery-reading__sections">
        <section className="delivery-reading__section delivery-reading__section--open">
          <header className="delivery-reading__section-header">
            <div>
              <p className="delivery-reading__section-eyebrow">Fila lida</p>
              <h3 className="delivery-reading__section-title">Entregas lidas</h3>
            </div>
            <span className="ui-badge ui-badge--warning">{openRecords.length}</span>
          </header>

          {openRecords.length === 0 ? (
            <ModuleEmptyState message="Nenhuma entrega lida em aberto" />
          ) : (
            <div className="delivery-reading__grid">
              {openRecords.map((record) => (
                <article
                  key={record.id}
                  className={`delivery-reading__card delivery-reading__card--open ${recentlyClosedRecordId === record.id ? 'delivery-reading__card--closing' : ''}${exitingIds.has(record.id) ? ' is-exiting' : ''}`}
                >
                  <div className="delivery-reading__top">
                    <div>
                      <p className="delivery-reading__eyebrow">Entrega lida</p>
                      <strong className="delivery-reading__code">{record.deliveryCode}</strong>
                    </div>
                    <div className="delivery-reading__badge-stack">
                      {record.turbo ? (
                        <span className="delivery-reading__turbo-badge">Turbo</span>
                      ) : null}
                      <span className="ui-badge ui-badge--warning">{record.status}</span>
                    </div>
                  </div>

                  <div className="delivery-reading__meta">
                    <div className="delivery-reading__meta-item">
                      <span>Entregador</span>
                      <strong>{record.courier}</strong>
                    </div>
                    <div className="delivery-reading__meta-item">
                      <span>Leitura</span>
                      <strong>{formatAuditText(record)}</strong>
                    </div>
                  </div>

                  <div className="delivery-reading__actions">
                    <button
                      type="button"
                      className="delivery-reading__close-button"
                      onClick={() => onApplyAction(record.id)}
                    >
                      <span className="delivery-reading__close-icon" aria-hidden="true" />
                      <span>Fechar entrega</span>
                    </button>

                    <button
                      type="button"
                      className="ui-button ui-button--danger"
                      disabled={exitingIds.has(record.id)}
                      onClick={() => onDelete(record.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="delivery-reading__section delivery-reading__section--closed">
          <header className="delivery-reading__section-header">
            <div>
              <p className="delivery-reading__section-eyebrow">Fechamento</p>
              <h3 className="delivery-reading__section-title">Entregas fechadas</h3>
            </div>
            <span className="ui-badge ui-badge--success">{closedRecords.length}</span>
          </header>

          {closedRecords.length === 0 ? (
            <ModuleEmptyState message="Nenhuma entrega fechada ainda" />
          ) : (
            <div className="delivery-reading__grid">
              {closedRecords.map((record) => (
                <article
                  key={record.id}
                  className={`delivery-reading__card delivery-reading__card--closed ${recentlyClosedRecordId === record.id ? 'delivery-reading__card--closed-fresh' : ''}${exitingIds.has(record.id) ? ' is-exiting' : ''}`}
                >
                  <div className="delivery-reading__top">
                    <div>
                      <p className="delivery-reading__eyebrow">Entrega fechada</p>
                      <strong className="delivery-reading__code">{record.deliveryCode}</strong>
                    </div>
                    <div className="delivery-reading__badge-stack">
                      {record.turbo ? (
                        <span className="delivery-reading__turbo-badge">Turbo</span>
                      ) : null}
                      <span className="ui-badge ui-badge--success">{record.status}</span>
                    </div>
                  </div>

                  <div className="delivery-reading__meta">
                    <div className="delivery-reading__meta-item">
                      <span>Entregador</span>
                      <strong>{record.courier}</strong>
                    </div>
                    <div className="delivery-reading__meta-item">
                      <span>Fechamento</span>
                      <strong>{formatAuditText(record)}</strong>
                    </div>
                  </div>

                  <div className="delivery-reading__actions">
                    <label className="delivery-reading__check is-checked">
                      <input type="checkbox" checked readOnly />
                      <span className="delivery-reading__check-box" aria-hidden="true" />
                      <span>Fechada no fluxo</span>
                    </label>

                    <button
                      type="button"
                      className="ui-button ui-button--danger"
                      disabled={exitingIds.has(record.id)}
                      onClick={() => onDelete(record.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function NativeModuleSchedule({
  records,
  scheduleMachineDrafts,
  scheduleMachineOptions,
  onDraftChange,
  onUpdate,
  onDelete,
  exitingIds,
}) {
  return (
    <div className="schedule-records">
      <div className="schedule-records__grid">
        {records.map((record) => (
          <article key={record.id} className={`schedule-records__card${exitingIds.has(record.id) ? ' is-exiting' : ''}`}>
            <div className="schedule-records__top">
              <div>
                <p className="schedule-records__eyebrow">Entregador</p>
                <strong className="schedule-records__name">{record.courier}</strong>
              </div>
              <span className="ui-badge ui-badge--info">{record.status}</span>
            </div>

            <div className="schedule-records__meta">
              <div className="schedule-records__meta-item">
                <span>Janela</span>
                <strong>{record.window}</strong>
              </div>
              <div className="schedule-records__meta-item">
                <span>Atualizacao</span>
                <strong>
                  {record.updatedAt && record.updatedBy
                    ? `${record.updatedBy} - ${record.updatedAt}`
                    : 'Sem atualizacao'}
                </strong>
              </div>
            </div>

            <div className="schedule-records__editor">
              <div className="ui-field">
                <label className="ui-label" htmlFor={`schedule-machine-${record.id}`}>
                  Maquininha do dia
                </label>
                <select
                  id={`schedule-machine-${record.id}`}
                  className="ui-select"
                  value={scheduleMachineDrafts[record.id] ?? record.machine ?? 'Sem maquininha'}
                  onChange={(event) => onDraftChange(record.id, event.target.value)}
                >
                  {scheduleMachineOptions.map((option) => (
                    <option key={`${record.id}-${option}`} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="schedule-records__actions">
                <button
                  type="button"
                  className="ui-button ui-button--secondary"
                  onClick={() => onUpdate(record.id)}
                  disabled={
                    exitingIds.has(record.id)
                    || (scheduleMachineDrafts[record.id] ?? record.machine ?? 'Sem maquininha')
                      === (record.machine ?? 'Sem maquininha')
                  }
                >
                  Salvar maquininha do dia
                </button>
                <button
                  type="button"
                  className="ui-button ui-button--danger"
                  disabled={exitingIds.has(record.id)}
                  onClick={() => onDelete(record.id)}
                >
                  Excluir
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function NativeModuleMachines({ records, onDelete, onToggle, exitingIds }) {
  return (
    <div className="machine-operations">
      <div className="machine-operations__list">
        {records.map((record) => {
          const isPresent = record.status === 'Presente'
          const statusLabel = isPresent ? 'Ativo' : 'Ausente'
          const statusClass = isPresent ? 'ui-badge--success' : 'ui-badge--warning'

          return (
            <article
              key={record.id}
              className={`machine-operations__row ${isPresent ? 'machine-operations__row--present' : 'machine-operations__row--absent'}${exitingIds.has(record.id) ? ' is-exiting' : ''}`}
            >
              <strong className="machine-operations__row-device">{record.device}</strong>
              <span className="machine-operations__row-meta">{record.holder || 'Sem entregador'}</span>
              <span className="machine-operations__row-meta">{record.model}</span>
              <span className={`ui-badge ${statusClass}`}>{statusLabel}</span>
              <label
                className={`machine-operations__row-check ${isPresent ? 'is-checked' : ''}`}
                htmlFor={`machine-check-${record.id}`}
              >
                <input
                  id={`machine-check-${record.id}`}
                  type="checkbox"
                  checked={isPresent}
                  disabled={exitingIds.has(record.id)}
                  onChange={() => onToggle(record.id)}
                />
                <span className="machine-operations__row-check-box" aria-hidden="true" />
                <span className="machine-operations__row-check-label">Confirmar</span>
              </label>
              <button
                type="button"
                className="machine-operations__icon-button"
                disabled={exitingIds.has(record.id)}
                onClick={() => onDelete(record.id)}
                aria-label={`Excluir ${record.device}`}
                title="Excluir"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 2h4l.5 1H13v1H3V3h2.5L6 2Zm-1 4h1v6H5V6Zm3 0h1v6H8V6Zm3 0h-1v6h1V6Z" />
                </svg>
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function NativeModuleTable({
  routePath,
  tableColumns,
  tableRows,
  manager,
  visibleRecords,
  scheduleMachineDrafts,
  scheduleMachineOptions,
  onDraftChange,
  onScheduleUpdate,
  onApplyAction,
  onMarkReturned,
  onDelete,
  exitingIds,
}) {
  return (
    <div className="native-module__table-wrap">
      <table className="ui-table">
        <thead>
          <tr>
            {tableColumns.map((column) => (
              <th key={`${routePath}-${column}`}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {manager
            ? visibleRecords.map((record, rowIndex) => {
              const row = manager.toRow(record)

              return (
                <tr
                  key={record.id}
                  className={`ui-table__row-enter${exitingIds.has(record.id) ? ' ui-table__row-exit' : ''}`}
                  style={{ '--row-delay': `${Math.min(rowIndex * 40, 240)}ms` }}
                >
                  {row.map((cell, index) => (
                    <td
                      key={`${record.id}-${index}`}
                      className={index === 0 ? 'ui-table__cell--strong' : undefined}
                    >
                      {renderNativeModuleCell(tableColumns[index], cell, index)}
                    </td>
                  ))}
                  <td className={`native-module__actions-cell${routePath === 'schedule' ? ' native-module__actions-cell--schedule' : ''}${routePath === 'change' ? ' native-module__actions-cell--return-visible' : ''}`}>
                    {routePath === 'schedule' ? (
                      <div className="native-module__inline-editor">
                        <select
                          className="ui-select native-module__inline-select"
                          value={scheduleMachineDrafts[record.id] ?? record.machine ?? 'Sem maquininha'}
                          onChange={(event) => onDraftChange(record.id, event.target.value)}
                        >
                          {scheduleMachineOptions.map((option) => (
                            <option key={`${record.id}-${option}`} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="ui-button ui-button--secondary native-module__table-action"
                          onClick={() => onScheduleUpdate(record.id)}
                          disabled={
                            exitingIds.has(record.id)
                            || (
                            (scheduleMachineDrafts[record.id] ?? record.machine ?? 'Sem maquininha')
                            === (record.machine ?? 'Sem maquininha')
                            )
                          }
                        >
                          Salvar
                        </button>
                      </div>
                    ) : null}
                    {manager.actionLabel ? (
                      <button
                        type="button"
                        className="ui-button ui-button--secondary native-module__table-action"
                        onClick={() => onApplyAction(record.id)}
                      >
                        {manager.getActionLabel?.(record) ?? manager.actionLabel}
                      </button>
                    ) : null}
                    {manager.returnActionLabel && record.status !== 'Retornou' ? (
                      <button
                        type="button"
                        className="native-module__return-action"
                        disabled={exitingIds.has(record.id)}
                        onClick={() => onMarkReturned(record.id)}
                      >
                        {manager.returnActionLabel}
                      </button>
                    ) : null}
                    {manager.allowDelete !== false ? (
                      <button
                        type="button"
                        className="native-module__delete-action"
                        disabled={exitingIds.has(record.id)}
                        onClick={() => onDelete(record.id)}
                        aria-label="Excluir registro"
                        title="Excluir"
                      >
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path d="M6 2h4l.5 1H13v1H3V3h2.5L6 2Zm-1 4h1v6H5V6Zm3 0h1v6H8V6Zm3 0h-1v6h1V6Z" />
                        </svg>
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })
            : tableRows.map((row, rowIndex) => (
              <tr
                key={`${routePath}-${row.join('-')}`}
                className="ui-table__row-enter"
                style={{ '--row-delay': `${Math.min(rowIndex * 40, 240)}ms` }}
              >
                {row.map((cell, index) => (
                  <td key={`${routePath}-${row[0]}-${index}`} className={index === 0 ? 'ui-table__cell--strong' : undefined}>
                    {renderNativeModuleCell(tableColumns[index], cell, index)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

function NativeModuleRecordsSection(props) {
  const {
    route,
    manager,
    tableTitle,
    errorMessage,
    records,
    tableRows,
    machineHistoryGroups,
    visibleOpenDeliveryRecords,
    visibleClosedDeliveryRecords,
    recentlyClosedRecordId,
    visibleRecords,
    visibleMachineChecklistRecords,
    formatAuditText,
    handleApplyAction,
    handleDelete,
    handleMachineChecklistToggle,
    scheduleMachineDrafts,
    scheduleMachineOptions,
    handleScheduleMachineDraftChange,
    handleScheduleMachineUpdate,
    statusField,
    searchTerm,
    statusFilter,
    setSearchTerm,
    setStatusFilter,
    visibleCount,
  handleExportScheduleImage,
  handleExportScheduleMachinesImage,
  handleExportMachineChecklistImage,
  handleExportBackup,
  handleManualReset,
  handleClearAll,
  tableColumns,
    handleMarkReturned,
  } = props

  const isMachineHistory = route.path === 'machine-history'
  const isDeliveryReading = route.path === 'delivery-reading'
  const isSchedule = route.path === 'schedule'
  const isMachineChecklist = route.path === 'machines'
  const [exitingIds, setExitingIds] = useState(() => new Set())
  const exitTimeoutsRef = useRef(new Map())

  useEffect(() => {
    const exitTimeouts = exitTimeoutsRef.current

    return () => {
      exitTimeouts.forEach((timeoutId) => clearTimeout(timeoutId))
      exitTimeouts.clear()
    }
  }, [])

  useEffect(() => {
    const visibleIds = new Set([
      ...visibleRecords.map((record) => record.id),
      ...visibleMachineChecklistRecords.map((record) => record.id),
      ...visibleOpenDeliveryRecords.map((record) => record.id),
      ...visibleClosedDeliveryRecords.map((record) => record.id),
    ])

    setExitingIds((current) => {
      const next = new Set()
      current.forEach((id) => {
        if (visibleIds.has(id)) {
          next.add(id)
        }
      })
      return next.size === current.size ? current : next
    })
  }, [visibleRecords, visibleMachineChecklistRecords, visibleOpenDeliveryRecords, visibleClosedDeliveryRecords])

  function clearExitingId(recordId) {
    setExitingIds((current) => {
      if (!current.has(recordId)) {
        return current
      }

      const next = new Set(current)
      next.delete(recordId)
      return next
    })

    const timeoutId = exitTimeoutsRef.current.get(recordId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      exitTimeoutsRef.current.delete(recordId)
    }
  }

  function requestDelete(recordId) {
    setExitingIds((current) => {
      if (current.has(recordId)) {
        return current
      }

      const next = new Set(current)
      next.add(recordId)
      return next
    })

    const timeoutId = setTimeout(async () => {
      exitTimeoutsRef.current.delete(recordId)
      await handleDelete(recordId)
      clearExitingId(recordId)
    }, getExitDuration())

    exitTimeoutsRef.current.set(recordId, timeoutId)
  }

  return (
    <SurfaceCard title={tableTitle}>
      <NativeModuleToolbar
        routePath={route.path}
        manager={manager}
        statusField={statusField}
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        setSearchTerm={setSearchTerm}
        setStatusFilter={setStatusFilter}
        visibleCount={visibleCount}
        recordsLength={records.length}
        onExportSchedule={handleExportScheduleImage}
        onExportScheduleMachines={handleExportScheduleMachinesImage}
        onExportMachines={handleExportMachineChecklistImage}
        onExportBackup={handleExportBackup}
        onManualReset={handleManualReset}
        onClearAll={handleClearAll}
      />

      {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

      {isMachineHistory ? (
        <NativeModuleMachineHistory groups={machineHistoryGroups} />
      ) : ((isMachineChecklist ? visibleMachineChecklistRecords.length === 0 : tableRows.length === 0) && manager) ? (
        <ModuleEmptyState
          message={records.length === 0 ? manager.emptyTitle : 'Nenhum resultado encontrado'}
        />
      ) : isDeliveryReading ? (
        <NativeModuleDeliveryReading
          openRecords={visibleOpenDeliveryRecords}
          closedRecords={visibleClosedDeliveryRecords}
          recentlyClosedRecordId={recentlyClosedRecordId}
          formatAuditText={formatAuditText}
          onApplyAction={handleApplyAction}
          onDelete={requestDelete}
          exitingIds={exitingIds}
        />
      ) : isSchedule ? (
        <NativeModuleSchedule
          records={visibleRecords}
          scheduleMachineDrafts={scheduleMachineDrafts}
          scheduleMachineOptions={scheduleMachineOptions}
          onDraftChange={handleScheduleMachineDraftChange}
          onUpdate={handleScheduleMachineUpdate}
          onDelete={requestDelete}
          exitingIds={exitingIds}
        />
      ) : isMachineChecklist ? (
        <NativeModuleMachines
          records={visibleMachineChecklistRecords}
          onDelete={requestDelete}
          onToggle={handleMachineChecklistToggle}
          exitingIds={exitingIds}
        />
      ) : (
        <NativeModuleTable
          routePath={route.path}
          tableColumns={tableColumns}
          tableRows={tableRows}
          manager={manager}
          visibleRecords={visibleRecords}
          scheduleMachineDrafts={scheduleMachineDrafts}
          scheduleMachineOptions={scheduleMachineOptions}
          onDraftChange={handleScheduleMachineDraftChange}
          onScheduleUpdate={handleScheduleMachineUpdate}
          onApplyAction={handleApplyAction}
          onMarkReturned={handleMarkReturned}
          onDelete={requestDelete}
          exitingIds={exitingIds}
        />
      )}
    </SurfaceCard>
  )
}

export default NativeModuleRecordsSection
