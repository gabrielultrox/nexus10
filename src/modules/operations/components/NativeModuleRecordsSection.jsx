import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import SurfaceCard from '../../../components/common/SurfaceCard'
import StatusBadge from '../../../components/ui/StatusBadge'
import DestructiveIconButton from '../../../components/ui/DestructiveIconButton'
import Select from '../../../components/ui/Select'
import EmptyState from '../../../components/ui/EmptyState'
import { Button, Input } from '../../../components/ui'
import { useConfirm } from '../../../hooks/useConfirm'

const ROW_EXIT_DURATION_MS = 200
const DEFAULT_SCHEDULE_WINDOWS = ['10:00', '14:00', '18:00']

function getStatusBadgeClass(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

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
  const normalized = String(record?.status ?? '')
    .trim()
    .toLowerCase()

  return !(
    normalized.includes('retorn') ||
    normalized.includes('conclu') ||
    normalized.includes('recebid')
  )
}

function renderNativeModuleCell(routePath, column, cell, index) {
  const normalizedColumn = String(column ?? '').toLowerCase()
  const normalizedValue = String(cell ?? '').toLowerCase()

  if (
    normalizedColumn.includes('status') ||
    normalizedColumn.includes('estado') ||
    normalizedColumn.includes('presenca')
  ) {
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

  if (
    normalizedColumn.includes('destino') ||
    normalizedColumn.includes('retorno') ||
    normalizedColumn.includes('atualizacao')
  ) {
    return <span className="ui-table__cell--muted">{cell}</span>
  }

  if (index === 0) {
    return <span className="ui-table__cell--strong">{cell}</span>
  }

  if (
    normalizedValue.includes('sem atualizacao') ||
    normalizedValue.includes('aguardando retorno')
  ) {
    return <span className="ui-table__cell--muted">{cell}</span>
  }

  return cell
}

function ModuleEmptyState({ message }) {
  return <EmptyState message={message} />
}

function getPrefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function getExitDuration() {
  return getPrefersReducedMotion() ? 0 : ROW_EXIT_DURATION_MS
}

function getContextHistoryLink(routePath) {
  const links = {
    'delivery-reading': {
      to: '/history?modulo=delivery-reading&data=hoje',
      label: 'Ver historico de leituras',
    },
    machines: {
      to: '/history?modulo=machines&data=hoje',
      label: 'Ver historico de hardware',
    },
    advances: {
      to: '/history?modulo=advances&data=hoje',
      label: 'Ver historico de vales',
    },
  }

  return links[routePath] ?? null
}

function normalizeScheduleWindow(windowLabel = '') {
  return String(windowLabel).replace(/\s+/g, '').split('-')[0].trim().toLowerCase()
}

function formatScheduleEntryTime(windowLabel = '') {
  return String(windowLabel).replace(/\s+/g, '').split('-')[0].trim()
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
  onExportDeliveredChanges,
  onPrintDeliveredChanges,
  onExportClosedDeliveries,
  onPrintClosedDeliveries,
  onExportPaidAdvances,
  onPrintPaidAdvances,
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

  const historyLink = getContextHistoryLink(routePath)

  return (
    <div className={`native-module__toolbar native-module__toolbar--${routePath}`}>
      <div className="native-module__toolbar-primary">
        <div className="ui-field">
          <label className="ui-label" htmlFor={`${routePath}-search`}>
            Buscar
          </label>
          <Input
            id={`${routePath}-search`}
            type="text"
            value={searchTerm}
            placeholder={
              routePath === 'machines'
                ? 'Dispositivo, entregador ou modelo'
                : 'Buscar nos registros'
            }
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
          {historyLink ? (
            <Link to={historyLink.to} className="native-module__history-link">
              {historyLink.label}
            </Link>
          ) : null}
          {routePath === 'schedule' ? (
            <div className="native-module__toolbar-menu" ref={menuRef}>
              <Button type="button" variant="ghost" onClick={onExportSchedule}>
                Exportar escala
              </Button>
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
                  <Button
                    type="button"
                    className="native-module__toolbar-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      onExportScheduleMachines()
                    }}
                    variant="ghost"
                  >
                    Exportar maquininhas usadas
                  </Button>
                  <Button
                    type="button"
                    className="native-module__toolbar-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      onExportBackup()
                    }}
                    variant="ghost"
                  >
                    Exportar backup
                  </Button>
                  {manager.manualResetLabel ? (
                    <Button
                      type="button"
                      className="native-module__toolbar-dropdown-item native-module__toolbar-dropdown-item--danger"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false)
                        onManualReset()
                      }}
                      variant="danger"
                    >
                      {manager.manualResetLabel}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {routePath === 'machines' ? (
            <Button type="button" variant="secondary" onClick={onExportMachines}>
              Exportar presentes
            </Button>
          ) : null}
          {routePath === 'change' ? (
            <>
              <Button type="button" variant="secondary" onClick={onExportDeliveredChanges}>
                Exportar entregues
              </Button>
              <Button type="button" variant="ghost" onClick={onPrintDeliveredChanges}>
                Imprimir entregues
              </Button>
            </>
          ) : null}
          {routePath === 'delivery-reading' ? (
            <>
              <Button type="button" variant="secondary" onClick={onExportClosedDeliveries}>
                Exportar fechadas
              </Button>
              <Button type="button" variant="ghost" onClick={onPrintClosedDeliveries}>
                Imprimir fechadas
              </Button>
            </>
          ) : null}
          {routePath === 'advances' ? (
            <>
              <Button type="button" variant="secondary" onClick={onExportPaidAdvances}>
                Exportar baixados
              </Button>
              <Button type="button" variant="ghost" onClick={onPrintPaidAdvances}>
                Imprimir baixados
              </Button>
            </>
          ) : null}
          {routePath !== 'schedule' ? (
            <Button type="button" variant="ghost" onClick={onExportBackup}>
              Exportar backup
            </Button>
          ) : null}
          {manager.manualResetLabel && routePath !== 'schedule' ? (
            <Button type="button" variant="ghost" onClick={onManualReset}>
              {manager.manualResetLabel}
            </Button>
          ) : null}
          {recordsLength > 0 && manager.allowClearAll !== false ? (
            <Button type="button" variant="ghost" onClick={onClearAll}>
              Limpar tudo
            </Button>
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
            {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
              new Date(),
            )}
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
          label:
            dayKey === todayKey
              ? 'Hoje'
              : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
                  new Date(dayKey),
                ),
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
          <strong className="schedule-records__title">Cobertura por entrada</strong>
        </div>
        <div
          className="schedule-records__view-toggle"
          role="tablist"
          aria-label="Visualizacao da escala"
        >
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
          <div
            className="schedule-grid__table"
            style={{
              gridTemplateColumns: `120px repeat(${scheduleDays.length}, minmax(180px, 1fr))`,
            }}
          >
            <div className="schedule-grid__head-cell schedule-grid__head-cell--window">Entrada</div>
            {scheduleDays.map((day) => (
              <div key={day.key} className="schedule-grid__head-cell">
                {day.label}
              </div>
            ))}

            {scheduleWindows.map((windowLabel) => (
              <div key={windowLabel} className="schedule-grid__row-group">
                <div className="schedule-grid__window-cell">
                  {formatScheduleEntryTime(windowLabel)}
                </div>
                {scheduleDays.map((day) => {
                  const matchingRecords = records.filter(
                    (record) =>
                      normalizeScheduleWindow(record.window) ===
                        normalizeScheduleWindow(windowLabel) &&
                      (record.dayKey ?? record.date ?? todayKey) === day.key,
                  )

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
                    <div
                      key={`${day.key}-${windowLabel}`}
                      className="schedule-grid__slot schedule-grid__slot--filled"
                    >
                      {matchingRecords.map((record) => {
                        return (
                          <div key={record.id} className="schedule-grid__entry">
                            <button
                              type="button"
                              className="schedule-grid__entry-header"
                              onClick={() => handleFilledSlotClick(record.id)}
                            >
                              <span className="schedule-grid__entry-name">{record.courier}</span>
                              <span className="ui-badge ui-badge--info">
                                {record.machine && record.machine !== 'Sem maquininha'
                                  ? record.machine
                                  : 'Sem maquininha'}
                              </span>
                            </button>
                            <div className="schedule-grid__entry-editor">
                              <Select
                                className="ui-select schedule-grid__entry-select"
                                value={
                                  scheduleMachineDrafts[record.id] ??
                                  record.machine ??
                                  'Sem maquininha'
                                }
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
                                className="ui-button ui-button--secondary schedule-grid__entry-save"
                                onClick={() => onUpdate(record.id)}
                                disabled={
                                  exitingIds.has(record.id) ||
                                  (scheduleMachineDrafts[record.id] ??
                                    record.machine ??
                                    'Sem maquininha') === (record.machine ?? 'Sem maquininha')
                                }
                              >
                                Salvar
                              </button>
                            </div>
                          </div>
                        )
                      })}
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
                  <span>Entrada</span>
                  <strong>{formatScheduleEntryTime(record.window)}</strong>
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
                      exitingIds.has(record.id) ||
                      (scheduleMachineDrafts[record.id] ?? record.machine ?? 'Sem maquininha') ===
                        (record.machine ?? 'Sem maquininha')
                    }
                  >
                    Salvar maquininha do dia
                  </button>
                  <DestructiveIconButton
                    className="schedule-records__delete-button"
                    disabled={exitingIds.has(record.id)}
                    onClick={() => onDelete(record.id)}
                    label={`Excluir escala de ${record.courier}`}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function isCompletedChangeRecord(record) {
  const normalized = String(record?.status ?? '')
    .trim()
    .toLowerCase()

  return (
    normalized.includes('conclu') || normalized.includes('retorn') || normalized.includes('recebid')
  )
}

function getReturnActionStateLabel(record) {
  const normalized = String(record?.status ?? '')
    .trim()
    .toLowerCase()

  if (
    normalized.includes('conclu') ||
    normalized.includes('retorn') ||
    normalized.includes('recebid')
  ) {
    return 'Retorno concluido'
  }

  return ''
}

function NativeModuleMachines({
  records,
  onDelete,
  onToggle,
  onConfirmAll,
  confirmedCount,
  selectedCount,
  selectedIds,
  totalCount,
  exitingIds,
  onToggleSelection,
  onToggleAllSelection,
  onClearSelection,
  allVisibleSelected,
  someVisibleSelected,
  isBulkConfirming,
  bulkConfirmProgress,
}) {
  const headerCheckboxRef = useRef(null)

  useEffect(() => {
    if (!headerCheckboxRef.current) {
      return
    }

    headerCheckboxRef.current.indeterminate = someVisibleSelected
  }, [someVisibleSelected])

  return (
    <div className="machine-operations">
      <div className="machine-operations__bulk-bar">
        <label className="machine-operations__bulk-check" htmlFor="machines-select-all">
          <input
            ref={headerCheckboxRef}
            id="machines-select-all"
            type="checkbox"
            checked={allVisibleSelected}
            disabled={totalCount === 0 || isBulkConfirming}
            onChange={() => onToggleAllSelection?.()}
          />
          <span>Selecionar todos visiveis</span>
        </label>
        <div className="machine-operations__bulk-meta">
          <span className="machine-operations__bulk-count">
            {selectedCount} de {totalCount} selecionadas
          </span>
          <span className="machine-operations__bulk-count machine-operations__bulk-count--muted">
            {confirmedCount} confirmadas no filtro
          </span>
          {isBulkConfirming ? (
            <span className="machine-operations__bulk-count machine-operations__bulk-count--processing">
              Processando {bulkConfirmProgress.processed} de {bulkConfirmProgress.total}
            </span>
          ) : null}
        </div>
        <div className="machine-operations__bulk-actions">
          <Button
            type="button"
            variant="primary"
            loading={isBulkConfirming}
            disabled={selectedCount === 0}
            onClick={() => onConfirmAll?.()}
          >
            Confirmar {selectedCount}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={selectedCount === 0 || isBulkConfirming}
            onClick={() => onClearSelection?.()}
          >
            Desselecionar todos
          </Button>
        </div>
      </div>
      <div className="machine-operations__card-grid">
        {records.map((record) => {
          const isPresent = record.status === 'Presente'
          const statusLabel = isPresent ? 'Ativo' : 'Ausente'
          const statusClass = isPresent ? 'ui-badge--success' : 'ui-badge--warning'
          const isSelected = selectedIds.includes(record.id)

          return (
            <article
              key={record.id}
              className={`machine-operations__card ${isPresent ? 'machine-operations__card--present' : 'machine-operations__card--absent'}${isSelected ? ' machine-operations__card--selected' : ''}${exitingIds.has(record.id) ? ' is-exiting' : ''}`}
            >
              <div className="machine-operations__card-top">
                <label
                  className={`machine-operations__selection-toggle ${isSelected ? 'is-selected' : ''}`}
                  htmlFor={`machine-select-${record.id}`}
                >
                  <input
                    id={`machine-select-${record.id}`}
                    type="checkbox"
                    checked={isSelected}
                    disabled={exitingIds.has(record.id) || isBulkConfirming}
                    onChange={() => onToggleSelection?.(record.id)}
                  />
                  <span className="machine-operations__selection-box" aria-hidden="true" />
                  <span className="machine-operations__selection-label">Selecionada</span>
                </label>
                <span className={`ui-badge ${statusClass}`}>{statusLabel}</span>
              </div>

              <div className="machine-operations__card-identity">
                <p className="machine-operations__card-eyebrow">Maquininha</p>
                <strong className="machine-operations__card-device">{record.device}</strong>
                <p className="machine-operations__card-holder">
                  {record.holder || 'Sem entregador vinculado'}
                </p>
              </div>

              <div className="machine-operations__card-meta">
                <div className="machine-operations__card-meta-item">
                  <span>Modelo</span>
                  <strong>{record.model || 'Nao informado'}</strong>
                </div>
                <div className="machine-operations__card-meta-item">
                  <span>Presenca</span>
                  <strong>{isPresent ? 'Confirmada' : 'Pendente'}</strong>
                </div>
              </div>

              <div className="machine-operations__card-actions">
                <label
                  className={`machine-operations__presence-toggle ${isPresent ? 'is-checked' : ''}`}
                  htmlFor={`machine-check-${record.id}`}
                >
                  <input
                    id={`machine-check-${record.id}`}
                    type="checkbox"
                    checked={isPresent}
                    disabled={exitingIds.has(record.id) || isBulkConfirming}
                    onChange={() => onToggle(record.id)}
                  />
                  <span className="machine-operations__presence-box" aria-hidden="true" />
                  <span className="machine-operations__presence-label">
                    {isPresent ? 'Confirmada' : 'Confirmar presenca'}
                  </span>
                </label>
                <DestructiveIconButton
                  className="machine-operations__icon-button"
                  disabled={exitingIds.has(record.id) || isBulkConfirming}
                  onClick={() => onDelete(record.id)}
                  label={`Excluir ${record.device}`}
                />
              </div>
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
  editableRecordDrafts,
  editableRecordOptions,
  scheduleMachineOptions,
  onDraftChange,
  onEditableRecordDraftChange,
  onScheduleUpdate,
  onEditableRecordUpdate,
  onApplyAction,
  onMarkReturned,
  onPrintOccurrence,
  onDelete,
  exitingIds,
  freshRecordId,
  highlightedRecordId,
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
                const isEditableRecord = routePath === 'change' || routePath === 'advances'
                const editableFieldValue =
                  routePath === 'change' ? (record.origin ?? '') : (record.recipient ?? '')
                const nextEditableFieldValue = String(
                  editableRecordDrafts?.[record.id] ?? editableFieldValue,
                ).trim()
                const actionCellClass = `native-module__actions-cell${routePath === 'schedule' ? ' native-module__actions-cell--schedule' : ''}${routePath === 'change' ? ' native-module__actions-cell--return-visible native-module__actions-cell--editable-record' : ''}${routePath === 'advances' ? ' native-module__actions-cell--editable-record' : ''}${routePath === 'delivery-reading' ? ' native-module__actions-cell--delivery-reading' : ''}`
                const actionContentClass = actionCellClass.replaceAll(
                  'native-module__actions-cell',
                  'native-module__actions-content',
                )

                return (
                  <tr
                    key={record.id}
                    className={`${record.id === freshRecordId ? 'ui-table__row-fresh-top' : 'ui-table__row-enter'}${record.id === highlightedRecordId ? ' native-module__table-row--highlighted' : ''}${exitingIds.has(record.id) ? ' ui-table__row-exit' : ''}`}
                    style={{
                      '--row-delay': `${Math.min(rowIndex * 40, 240)}ms`,
                      '--row-flash-color':
                        routePath === 'delivery-reading' ? 'rgba(34, 197, 94, 0.08)' : undefined,
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
                    <td className={actionCellClass}>
                      <div className={actionContentClass}>
                        {routePath === 'schedule' ? (
                          <div className="native-module__inline-editor">
                            <Select
                              className="ui-select native-module__inline-select"
                              value={
                                scheduleMachineDrafts[record.id] ??
                                record.machine ??
                                'Sem maquininha'
                              }
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
                                exitingIds.has(record.id) ||
                                (scheduleMachineDrafts[record.id] ??
                                  record.machine ??
                                  'Sem maquininha') === (record.machine ?? 'Sem maquininha')
                              }
                            >
                              Salvar
                            </button>
                          </div>
                        ) : null}
                        {isEditableRecord ? (
                          <div className="native-module__inline-editor native-module__inline-editor--record-field">
                            <Select
                              className="ui-select native-module__inline-select"
                              value={nextEditableFieldValue}
                              onChange={(event) =>
                                onEditableRecordDraftChange(record.id, event.target.value)
                              }
                            >
                              {editableRecordOptions.map((option) => (
                                <option key={`${record.id}-${option}`} value={option}>
                                  {option}
                                </option>
                              ))}
                            </Select>
                            <button
                              type="button"
                              className="ui-button ui-button--secondary native-module__table-action"
                              onClick={() => onEditableRecordUpdate(record.id)}
                              disabled={
                                exitingIds.has(record.id) ||
                                !nextEditableFieldValue ||
                                nextEditableFieldValue === String(editableFieldValue).trim()
                              }
                            >
                              Salvar
                            </button>
                          </div>
                        ) : null}
                        <div className="native-module__action-group">
                          {routePath === 'occurrences' ? (
                            <button
                              type="button"
                              className="ui-button ui-button--ghost native-module__table-action"
                              onClick={() => onPrintOccurrence(record.id)}
                              disabled={exitingIds.has(record.id)}
                            >
                              Imprimir
                            </button>
                          ) : null}
                          {manager.actionLabel ? (
                            <button
                              type="button"
                              className="ui-button ui-button--secondary native-module__table-action"
                              onClick={() => onApplyAction(record.id)}
                              disabled={exitingIds.has(record.id)}
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
                          {manager.returnActionLabel && !canShowReturnAction(record) ? (
                            <span className="native-module__action-state-label">
                              {getReturnActionStateLabel(record)}
                            </span>
                          ) : null}
                          {manager.allowDelete !== false ? (
                            <DestructiveIconButton
                              className="native-module__delete-action"
                              disabled={exitingIds.has(record.id)}
                              onClick={() => onDelete(record.id)}
                              label="Excluir registro"
                            />
                          ) : null}
                        </div>
                      </div>
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
                    <td
                      key={`${routePath}-${row[0]}-${index}`}
                      className={index === 0 ? 'ui-table__cell--strong' : undefined}
                    >
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
    machineSelectedCount,
    machineSelectedIds,
    machineAllVisibleSelected,
    machineSomeVisibleSelected,
    handleApplyAction,
    handleDelete,
    handleMachineChecklistToggle,
    handleConfirmAllMachines,
    handleToggleMachineSelection,
    handleToggleAllMachineSelection,
    handleClearMachineSelection,
    isBulkConfirmingMachines,
    bulkConfirmProgress,
    scheduleMachineDrafts,
    editableRecordDrafts,
    editableRecordOptions,
    scheduleMachineOptions,
    handleScheduleMachineDraftChange,
    handleEditableRecordDraftChange,
    handleScheduleMachineUpdate,
    handleEditableRecordUpdate,
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
    handleExportDeliveredChangesImage,
    handlePrintDeliveredChanges,
    handleExportClosedDeliveriesImage,
    handlePrintClosedDeliveries,
    handleExportPaidAdvancesImage,
    handlePrintPaidAdvances,
    handleExportBackup,
    handleManualReset,
    handleClearAll,
    tableColumns,
    handleMarkReturned,
    handlePrintOccurrence,
    freshRecordId,
    highlightedRecordId,
  } = props

  const isMachineHistory = route.path === 'machine-history'
  const isSchedule = route.path === 'schedule'
  const isMachineChecklist = route.path === 'machines'
  const isDeliveryReading = route.path === 'delivery-reading'
  const isChangeModule = route.path === 'change'
  const confirm = useConfirm()
  const [exitingIds, setExitingIds] = useState(() => new Set())
  const [deliveryReadingTab, setDeliveryReadingTab] = useState('open')
  const [changeTab, setChangeTab] = useState('pending')
  const exitTimeoutsRef = useRef(new Map())

  const deliveryReadingCounts = useMemo(() => {
    if (!isDeliveryReading) {
      return { open: 0, closed: 0 }
    }

    return visibleRecords.reduce(
      (accumulator, record) => {
        if (record.closed) {
          accumulator.closed += 1
        } else {
          accumulator.open += 1
        }

        return accumulator
      },
      { open: 0, closed: 0 },
    )
  }, [isDeliveryReading, visibleRecords])

  const deliveryReadingVisibleRecords = useMemo(() => {
    if (!isDeliveryReading) {
      return visibleRecords
    }

    return visibleRecords.filter((record) =>
      deliveryReadingTab === 'closed' ? Boolean(record.closed) : !record.closed,
    )
  }, [deliveryReadingTab, isDeliveryReading, visibleRecords])

  const changeCounts = useMemo(() => {
    if (!isChangeModule) {
      return { pending: 0, completed: 0 }
    }

    return visibleRecords.reduce(
      (accumulator, record) => {
        if (isCompletedChangeRecord(record)) {
          accumulator.completed += 1
        } else {
          accumulator.pending += 1
        }

        return accumulator
      },
      { pending: 0, completed: 0 },
    )
  }, [isChangeModule, visibleRecords])

  const changeVisibleRecords = useMemo(() => {
    if (!isChangeModule) {
      return visibleRecords
    }

    return visibleRecords.filter((record) =>
      changeTab === 'completed'
        ? isCompletedChangeRecord(record)
        : !isCompletedChangeRecord(record),
    )
  }, [changeTab, isChangeModule, visibleRecords])

  useEffect(() => {
    if (!highlightedRecordId) {
      return
    }

    const highlightedRecord = visibleRecords.find((record) => record.id === highlightedRecordId)

    if (!highlightedRecord) {
      return
    }

    if (isDeliveryReading) {
      setDeliveryReadingTab(highlightedRecord.closed ? 'closed' : 'open')
      return
    }

    if (isChangeModule) {
      setChangeTab(isCompletedChangeRecord(highlightedRecord) ? 'completed' : 'pending')
    }
  }, [highlightedRecordId, isChangeModule, isDeliveryReading, visibleRecords])

  const displayedRecords = isDeliveryReading
    ? deliveryReadingVisibleRecords
    : isChangeModule
      ? changeVisibleRecords
      : visibleRecords
  const displayedVisibleCount = isDeliveryReading
    ? deliveryReadingVisibleRecords.length
    : isChangeModule
      ? changeVisibleRecords.length
      : visibleCount

  useEffect(() => {
    const exitTimeouts = exitTimeoutsRef.current

    return () => {
      exitTimeouts.forEach((timeoutId) => clearTimeout(timeoutId))
      exitTimeouts.clear()
    }
  }, [])

  useEffect(() => {
    const visibleIds = new Set([
      ...displayedRecords.map((record) => record.id),
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
  }, [displayedRecords, visibleMachineChecklistRecords])

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

  async function requestDelete(recordId) {
    const confirmed = await confirm.ask({
      title: 'Excluir registro',
      message: 'Confirma a exclusao deste registro?',
      confirmLabel: 'Excluir registro',
      tone: 'danger',
    })

    if (!confirmed) {
      return
    }

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
        visibleCount={displayedVisibleCount}
        recordsLength={records.length}
        onExportSchedule={handleExportScheduleImage}
        onExportScheduleMachines={handleExportScheduleMachinesImage}
        onExportMachines={handleExportMachineChecklistImage}
        onExportDeliveredChanges={handleExportDeliveredChangesImage}
        onPrintDeliveredChanges={handlePrintDeliveredChanges}
        onExportClosedDeliveries={handleExportClosedDeliveriesImage}
        onPrintClosedDeliveries={handlePrintClosedDeliveries}
        onExportPaidAdvances={handleExportPaidAdvancesImage}
        onPrintPaidAdvances={handlePrintPaidAdvances}
        onExportBackup={handleExportBackup}
        onManualReset={handleManualReset}
        onClearAll={handleClearAll}
      />

      {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

      {isDeliveryReading ? (
        <div
          className="delivery-reading__list-tabs"
          role="tablist"
          aria-label="Filtrar leituras por estado"
        >
          <button
            type="button"
            className={`delivery-reading__list-tab${deliveryReadingTab === 'open' ? ' is-active' : ''}`}
            onClick={() => setDeliveryReadingTab('open')}
          >
            <span>Lidas</span>
            <span className="delivery-reading__list-tab-count">{deliveryReadingCounts.open}</span>
          </button>
          <button
            type="button"
            className={`delivery-reading__list-tab${deliveryReadingTab === 'closed' ? ' is-active' : ''}`}
            onClick={() => setDeliveryReadingTab('closed')}
          >
            <span>Fechadas</span>
            <span className="delivery-reading__list-tab-count">{deliveryReadingCounts.closed}</span>
          </button>
        </div>
      ) : null}

      {isChangeModule ? (
        <div
          className="delivery-reading__list-tabs"
          role="tablist"
          aria-label="Filtrar trocos por estado"
        >
          <button
            type="button"
            className={`delivery-reading__list-tab${changeTab === 'pending' ? ' is-active' : ''}`}
            onClick={() => setChangeTab('pending')}
          >
            <span>Pendentes</span>
            <span className="delivery-reading__list-tab-count">{changeCounts.pending}</span>
          </button>
          <button
            type="button"
            className={`delivery-reading__list-tab${changeTab === 'completed' ? ' is-active' : ''}`}
            onClick={() => setChangeTab('completed')}
          >
            <span>Concluidos</span>
            <span className="delivery-reading__list-tab-count">{changeCounts.completed}</span>
          </button>
        </div>
      ) : null}

      {isMachineHistory ? (
        <NativeModuleMachineHistory groups={machineHistoryGroups} />
      ) : (isMachineChecklist
          ? visibleMachineChecklistRecords.length === 0
          : !isSchedule && displayedRecords.length === 0) && manager ? (
        <ModuleEmptyState
          message={records.length === 0 ? manager.emptyTitle : 'Nenhum resultado encontrado'}
        />
      ) : isSchedule ? (
        <NativeModuleSchedule
          records={displayedRecords}
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
          selectedCount={machineSelectedCount}
          selectedIds={machineSelectedIds}
          totalCount={visibleMachineChecklistRecords.length}
          exitingIds={exitingIds}
          onToggleSelection={handleToggleMachineSelection}
          onToggleAllSelection={handleToggleAllMachineSelection}
          onClearSelection={handleClearMachineSelection}
          allVisibleSelected={machineAllVisibleSelected}
          someVisibleSelected={machineSomeVisibleSelected}
          isBulkConfirming={isBulkConfirmingMachines}
          bulkConfirmProgress={bulkConfirmProgress}
        />
      ) : (
        <NativeModuleTable
          routePath={route.path}
          tableColumns={tableColumns}
          tableRows={tableRows}
          manager={manager}
          visibleRecords={displayedRecords}
          scheduleMachineDrafts={scheduleMachineDrafts}
          editableRecordDrafts={editableRecordDrafts}
          editableRecordOptions={editableRecordOptions}
          scheduleMachineOptions={scheduleMachineOptions}
          onDraftChange={handleScheduleMachineDraftChange}
          onEditableRecordDraftChange={handleEditableRecordDraftChange}
          onScheduleUpdate={handleScheduleMachineUpdate}
          onEditableRecordUpdate={handleEditableRecordUpdate}
          onApplyAction={handleApplyAction}
          onMarkReturned={handleMarkReturned}
          onPrintOccurrence={handlePrintOccurrence}
          onDelete={requestDelete}
          exitingIds={exitingIds}
          freshRecordId={freshRecordId}
          highlightedRecordId={highlightedRecordId}
        />
      )}
    </SurfaceCard>
  )
}

export default NativeModuleRecordsSection
