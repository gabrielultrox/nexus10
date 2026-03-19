import { useEffect, useRef, useState } from 'react'

import SurfaceCard from '../../../components/common/SurfaceCard'
import StatusBadge from '../../../components/ui/StatusBadge'
import Select from '../../../components/ui/Select'
import EmptyState from '../../../components/ui/EmptyState'

const ROW_EXIT_DURATION_MS = 200
const DEFAULT_SCHEDULE_WINDOWS = ['10:00-14:00', '14:00-18:00', '18:00-22:00']

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

function canShowReturnAction(record) {
  const normalized = String(record?.status ?? '').trim().toLowerCase()

  return !(
    normalized.includes('retorn') ||
    normalized.includes('conclu') ||
    normalized.includes('recebid')
  )
}

function renderNativeModuleCell(routePath, column, cell, index) {
  const normalizedColumn = String(column ?? '').toLowerCase()
  const normalizedValue = String(cell ?? '').toLowerCase()

  if (normalizedColumn.includes('status') || normalizedColumn.includes('estado') || normalizedColumn.includes('presenca')) {
    return <span className={`ui-badge ${getStatusBadgeClass(cell)}`}>{cell}</span>
  }

  if (routePath === 'delivery-reading' && normalizedColumn.includes('turbo')) {
    return <StatusBadge status={normalizedValue === 'sim' ? 'turbo' : 'padrao'} size="md" />
  }

  if (routePath === 'delivery-reading' && normalizedColumn.includes('fechada')) {
    return <StatusBadge status={normalizedValue === 'sim' ? 'confirmado' : 'pendente'} size="md" />
  }

  if (routePath === 'delivery-reading' && normalizedColumn.includes('turno')) {
    return <span className="ui-table__cell--muted">{cell}</span>
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
  return <EmptyState message={message} />
}

function getPrefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getExitDuration() {
  return getPrefersReducedMotion() ? 0 : ROW_EXIT_DURATION_MS
}

function normalizeScheduleWindow(windowLabel = '') {
  return String(windowLabel).replace(/\s+/g, '').trim().toLowerCase()
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
            <Select
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
            </Select>
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

function NativeModuleSchedule({
  records,
  scheduleMachineDrafts,
  scheduleMachineOptions,
  onDraftChange,
  onUpdate,
  onDelete,
  exitingIds,
  highlightedRecordId,
  onHighlightRecord,
  onPrefillWindow,
}) {
  const [viewMode, setViewMode] = useState('list')
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const days = Array.from(
    records.reduce((accumulator, record) => {
      const dayKey = record.dayKey ?? record.date ?? todayKey

      if (!accumulator.some((item) => item.key === dayKey)) {
        accumulator.push({
          key: dayKey,
          label: dayKey === todayKey
            ? 'Hoje'
            : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(dayKey)),
        })
      }

      return accumulator
    }, []),
  ).slice(0, 4)
  const scheduleDays = days.length > 0 ? days : [{ key: todayKey, label: 'Hoje' }]
  const scheduleWindows = Array.from(
    new Set([
      ...DEFAULT_SCHEDULE_WINDOWS,
      ...records.map((record) => record.window).filter(Boolean),
    ]),
  )

  useEffect(() => {
    if (records.length === 0) {
      setViewMode('grid')
    }
  }, [records.length])

  function handleEmptySlotClick(windowLabel, dayKey) {
    onPrefillWindow?.(windowLabel, dayKey)
  }

  function handleFilledSlotClick(recordId) {
    onHighlightRecord?.(recordId)
    setViewMode('list')
  }

  return (
    <div className="schedule-records">
      <div className="schedule-records__header">
        <div>
          <p className="schedule-records__eyebrow">Painel de turno</p>
          <strong className="schedule-records__title">Cobertura por janela</strong>
        </div>
        <div className="schedule-records__view-toggle" role="tablist" aria-label="Visualizacao da escala">
          <button
            type="button"
            className={`schedule-records__view-button${viewMode === 'list' ? ' is-active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            Lista
          </button>
          <button
            type="button"
            className={`schedule-records__view-button${viewMode === 'grid' ? ' is-active' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            Grade
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="schedule-grid">
          <div className="schedule-grid__table">
            <div className="schedule-grid__head-cell schedule-grid__head-cell--window">Janela</div>
            {scheduleDays.map((day) => (
              <div key={day.key} className="schedule-grid__head-cell">
                {day.label}
              </div>
            ))}

            {scheduleWindows.map((windowLabel) => (
              <div key={windowLabel} className="schedule-grid__row-group">
                <div className="schedule-grid__window-cell">{windowLabel}</div>
                {scheduleDays.map((day) => {
                  const matchingRecords = records.filter((record) => (
                    normalizeScheduleWindow(record.window) === normalizeScheduleWindow(windowLabel)
                    && (record.dayKey ?? record.date ?? todayKey) === day.key
                  ))

                  if (matchingRecords.length === 0) {
                    return (
                      <button
                        key={`${day.key}-${windowLabel}`}
                        type="button"
                        className="schedule-grid__slot schedule-grid__slot--empty"
                        onClick={() => handleEmptySlotClick(windowLabel, day.key)}
                      >
                        <span>—</span>
                      </button>
                    )
                  }

                  return (
                    <div key={`${day.key}-${windowLabel}`} className="schedule-grid__slot schedule-grid__slot--filled">
                      {matchingRecords.map((record) => (
                        <button
                          key={record.id}
                          type="button"
                          className="schedule-grid__entry"
                          onClick={() => handleFilledSlotClick(record.id)}
                        >
                          <span className="schedule-grid__entry-name">{record.courier}</span>
                          <span className="ui-badge ui-badge--info">
                            {record.machine && record.machine !== 'Sem maquininha' ? record.machine : 'Sem maquininha'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="schedule-records__grid">
          {records.map((record) => (
            <article
              key={record.id}
              className={`schedule-records__card${exitingIds.has(record.id) ? ' is-exiting' : ''}${highlightedRecordId === record.id ? ' schedule-records__card--highlighted' : ''}`}
            >
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
                  <Select
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
                  </Select>
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
      )}
    </div>
  )
}

function NativeModuleMachines({ records, onDelete, onToggle, onConfirmAll, confirmedCount, totalCount, exitingIds }) {
  const allConfirmed = totalCount > 0 && confirmedCount === totalCount

  return (
    <div className="machine-operations">
      <div className="machine-operations__bulk-bar">
        <label className="machine-operations__bulk-check" htmlFor="machines-confirm-all">
          <input
            id="machines-confirm-all"
            type="checkbox"
            checked={allConfirmed}
            onChange={(event) => {
              if (event.target.checked) {
                onConfirmAll?.()
              }
            }}
          />
          <span>Confirmar todos presentes</span>
        </label>
        <span className="machine-operations__bulk-count">{confirmedCount} de {totalCount} confirmadas</span>
      </div>
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
                  <path d="M4.47 4.47a.75.75 0 0 1 1.06 0L8 6.94l2.47-2.47a.75.75 0 1 1 1.06 1.06L9.06 8l2.47 2.47a.75.75 0 1 1-1.06 1.06L8 9.06l-2.47 2.47a.75.75 0 1 1-1.06-1.06L6.94 8 4.47 5.53a.75.75 0 0 1 0-1.06Z" />
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
  freshRecordId,
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
                  className={`${record.id === freshRecordId ? 'ui-table__row-fresh-top' : 'ui-table__row-enter'}${exitingIds.has(record.id) ? ' ui-table__row-exit' : ''}`}
                  style={{
                    '--row-delay': `${Math.min(rowIndex * 40, 240)}ms`,
                    '--row-flash-color': routePath === 'delivery-reading'
                      ? 'rgba(34, 197, 94, 0.08)'
                      : undefined,
                  }}
                >
                  {row.map((cell, index) => (
                    <td
                      key={`${record.id}-${index}`}
                      className={index === 0 ? 'ui-table__cell--strong' : undefined}
                    >
                      {renderNativeModuleCell(routePath, tableColumns[index], cell, index)}
                    </td>
                  ))}
                  <td className={`native-module__actions-cell${routePath === 'schedule' ? ' native-module__actions-cell--schedule' : ''}${routePath === 'change' ? ' native-module__actions-cell--return-visible' : ''}${routePath === 'delivery-reading' ? ' native-module__actions-cell--delivery-reading' : ''}`}>
                    {routePath === 'schedule' ? (
                      <div className="native-module__inline-editor">
                        <Select
                          className="ui-select native-module__inline-select"
                          value={scheduleMachineDrafts[record.id] ?? record.machine ?? 'Sem maquininha'}
                          onChange={(event) => onDraftChange(record.id, event.target.value)}
                        >
                          {scheduleMachineOptions.map((option) => (
                            <option key={`${record.id}-${option}`} value={option}>
                              {option}
                            </option>
                          ))}
                        </Select>
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
                    {manager.actionLabel && routePath !== 'delivery-reading' ? (
                      <button
                        type="button"
                        className="ui-button ui-button--secondary native-module__table-action"
                        onClick={() => onApplyAction(record.id)}
                      >
                        {manager.getActionLabel?.(record) ?? manager.actionLabel}
                      </button>
                    ) : null}
                    {manager.returnActionLabel && canShowReturnAction(record) ? (
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
                    {renderNativeModuleCell(routePath, tableColumns[index], cell, index)}
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
    visibleRecords,
    visibleMachineChecklistRecords,
    machineConfirmedCount,
    handleApplyAction,
    handleDelete,
    handleMachineChecklistToggle,
    handleConfirmAllMachines,
    scheduleMachineDrafts,
    scheduleMachineOptions,
    handleScheduleMachineDraftChange,
    handleScheduleMachineUpdate,
    handleSchedulePrefill,
    handleScheduleHighlight,
    highlightedScheduleRecordId,
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
    freshRecordId,
  } = props

  const isMachineHistory = route.path === 'machine-history'
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
  }, [visibleRecords, visibleMachineChecklistRecords])

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
      ) : ((isMachineChecklist ? visibleMachineChecklistRecords.length === 0 : (!isSchedule && tableRows.length === 0)) && manager) ? (
        <ModuleEmptyState
          message={records.length === 0 ? manager.emptyTitle : 'Nenhum resultado encontrado'}
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
          highlightedRecordId={highlightedScheduleRecordId}
          onHighlightRecord={handleScheduleHighlight}
          onPrefillWindow={handleSchedulePrefill}
        />
      ) : isMachineChecklist ? (
        <NativeModuleMachines
          records={visibleMachineChecklistRecords}
          onDelete={requestDelete}
          onToggle={handleMachineChecklistToggle}
          onConfirmAll={handleConfirmAllMachines}
          confirmedCount={machineConfirmedCount}
          totalCount={visibleMachineChecklistRecords.length}
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
          freshRecordId={freshRecordId}
        />
      )}
    </SurfaceCard>
  )
}

export default NativeModuleRecordsSection


