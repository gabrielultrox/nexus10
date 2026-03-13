import SurfaceCard from '../../../components/common/SurfaceCard'

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
  onManualReset,
  onClearAll,
}) {
  if (!manager || manager.hideToolbar) {
    return null
  }

  return (
    <div className="native-module__toolbar">
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

      <div className="native-module__toolbar-actions">
        <span className="ui-badge ui-badge--special">{visibleCount} visiveis</span>
        {routePath === 'schedule' ? (
          <>
            <button type="button" className="ui-button ui-button--secondary" onClick={onExportSchedule}>
              Exportar escala
            </button>
            <button type="button" className="ui-button ui-button--secondary" onClick={onExportScheduleMachines}>
              Exportar maquininhas usadas
            </button>
          </>
        ) : null}
        {routePath === 'machines' ? (
          <button type="button" className="ui-button ui-button--secondary" onClick={onExportMachines}>
            Exportar presentes
          </button>
        ) : null}
        {manager.manualResetLabel ? (
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
            <div className="native-module__empty-state">
              <p className="text-section-title">Nenhum historico encontrado</p>
              <p className="text-body">
                As marcacoes do checklist das maquininhas vao aparecer aqui por dia.
              </p>
            </div>
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
            <div className="delivery-reading__empty">
              <p className="text-label">Nenhuma entrega lida em aberto</p>
              <p className="text-body">
                As entregas lidas e ainda nao fechadas vao aparecer primeiro aqui.
              </p>
            </div>
          ) : (
            <div className="delivery-reading__grid">
              {openRecords.map((record) => (
                <article
                  key={record.id}
                  className={`delivery-reading__card delivery-reading__card--open ${recentlyClosedRecordId === record.id ? 'delivery-reading__card--closing' : ''}`}
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
            <div className="delivery-reading__empty">
              <p className="text-label">Nenhuma entrega fechada ainda</p>
              <p className="text-body">
                Quando a leitura for confirmada como fechada, ela migra para esta area.
              </p>
            </div>
          ) : (
            <div className="delivery-reading__grid">
              {closedRecords.map((record) => (
                <article
                  key={record.id}
                  className={`delivery-reading__card delivery-reading__card--closed ${recentlyClosedRecordId === record.id ? 'delivery-reading__card--closed-fresh' : ''}`}
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
}) {
  return (
    <div className="schedule-records">
      <div className="schedule-records__grid">
        {records.map((record) => (
          <article key={record.id} className="schedule-records__card">
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
                    (scheduleMachineDrafts[record.id] ?? record.machine ?? 'Sem maquininha')
                    === (record.machine ?? 'Sem maquininha')
                  }
                >
                  Salvar maquininha do dia
                </button>
                <button type="button" className="ui-button ui-button--danger" onClick={() => onDelete(record.id)}>
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

function NativeModuleMachines({ records, onApplyAction, onDelete, onToggle }) {
  return (
    <div className="machine-operations">
      <div className="machine-operations__header">
        <div>
          <span className="machine-operations__eyebrow">Checklist do dia</span>
          <h3 className="machine-operations__title">Parque operacional leve e direto</h3>
          <p className="machine-operations__description">
            Confira presenca, entregador vinculado e situacao da maquininha no mesmo card.
          </p>
        </div>
        <div className="machine-operations__summary">
          <span className="ui-badge ui-badge--success">
            {records.filter((record) => record.status === 'Presente').length} presentes
          </span>
          <span className="ui-badge ui-badge--info">{records.length} dispositivos</span>
        </div>
      </div>

      <div className="machine-operations__grid">
        {records.map((record) => {
          const isPresent = record.status === 'Presente'
          const hasProblem = ['Manutencao', 'Carga'].includes(record.machineStatus)

          return (
            <article
              key={record.id}
              className={`machine-operations__card ${isPresent ? 'machine-operations__card--present' : 'machine-operations__card--absent'}`}
            >
              <div className="machine-operations__card-top">
                <div className="machine-operations__identity">
                  <span className="machine-operations__device-label">Maquininha</span>
                  <strong className="machine-operations__device">{record.device}</strong>
                </div>

                <div className="machine-operations__badges">
                  <span className={`ui-badge ${isPresent ? 'ui-badge--success' : 'ui-badge--warning'}`}>
                    {isPresent ? 'Presente' : 'Ausente'}
                  </span>
                  <span className={`ui-badge ${hasProblem ? 'ui-badge--danger' : 'ui-badge--info'}`}>
                    {record.machineStatus}
                  </span>
                </div>
              </div>

              <div className="machine-operations__meta-grid">
                <div className="machine-operations__meta-item">
                  <span>Entregador</span>
                  <strong>{record.holder || 'Sem entregador'}</strong>
                </div>
                <div className="machine-operations__meta-item">
                  <span>Modelo</span>
                  <strong>{record.model}</strong>
                </div>
              </div>

              <div className="machine-operations__footer">
                <span className="machine-operations__updated">
                  {record.updatedAt && record.updatedBy
                    ? `${record.updatedBy} - ${record.updatedAt}`
                    : 'Sem conferencia hoje'}
                </span>

                <div className="machine-operations__actions">
                  <label
                    className={`machine-operations__presence-check ${isPresent ? 'is-checked' : ''}`}
                    htmlFor={`machine-check-${record.id}`}
                  >
                    <input
                      id={`machine-check-${record.id}`}
                      type="checkbox"
                      checked={isPresent}
                      onChange={() => onToggle(record.id)}
                    />
                    <span className="machine-operations__presence-box" aria-hidden="true" />
                    <span>{isPresent ? 'Presente hoje' : 'Confirmar presenca'}</span>
                  </label>

                  {record.machineStatus !== 'Ativa' ? (
                    <button type="button" className="ui-button ui-button--secondary" onClick={() => onApplyAction(record.id)}>
                      Marcar ativa
                    </button>
                  ) : null}

                  <button type="button" className="ui-button ui-button--danger" onClick={() => onDelete(record.id)}>
                    Excluir
                  </button>
                </div>
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
  scheduleMachineOptions,
  onDraftChange,
  onScheduleUpdate,
  onApplyAction,
  onMarkReturned,
  onDelete,
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
            ? visibleRecords.map((record) => {
              const row = manager.toRow(record)

              return (
                <tr key={record.id}>
                  {row.map((cell, index) => (
                    <td key={`${record.id}-${index}`} className={index === 0 ? 'ui-table__cell--strong' : undefined}>
                      {cell}
                    </td>
                  ))}
                  <td className={`native-module__actions-cell${routePath === 'schedule' ? ' native-module__actions-cell--schedule' : ''}`}>
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
                            (scheduleMachineDrafts[record.id] ?? record.machine ?? 'Sem maquininha')
                            === (record.machine ?? 'Sem maquininha')
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
                        className="ui-button ui-button--success native-module__table-action"
                        onClick={() => onMarkReturned(record.id)}
                      >
                        {manager.returnActionLabel}
                      </button>
                    ) : null}
                    {manager.allowDelete !== false ? (
                      <button
                        type="button"
                        className="ui-button ui-button--danger native-module__table-action"
                        onClick={() => onDelete(record.id)}
                      >
                        Excluir
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })
            : tableRows.map((row) => (
              <tr key={`${routePath}-${row.join('-')}`}>
                {row.map((cell, index) => (
                  <td key={`${routePath}-${row[0]}-${index}`} className={index === 0 ? 'ui-table__cell--strong' : undefined}>
                    {cell}
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
    handleManualReset,
    handleClearAll,
    tableColumns,
    handleMarkReturned,
  } = props

  const isMachineHistory = route.path === 'machine-history'
  const isDeliveryReading = route.path === 'delivery-reading'
  const isSchedule = route.path === 'schedule'
  const isMachineChecklist = route.path === 'machines'

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
        onManualReset={handleManualReset}
        onClearAll={handleClearAll}
      />

      {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

      {isMachineHistory ? (
        <NativeModuleMachineHistory groups={machineHistoryGroups} />
      ) : ((isMachineChecklist ? visibleMachineChecklistRecords.length === 0 : tableRows.length === 0) && manager) ? (
        <div className="native-module__empty-state">
          <p className="text-section-title">
            {records.length === 0 ? manager.emptyTitle : 'Nenhum resultado encontrado'}
          </p>
          <p className="text-body">
            {records.length === 0
              ? manager.emptyDescription
              : 'Ajuste a busca ou o filtro para localizar registros deste modulo.'}
          </p>
        </div>
      ) : isDeliveryReading ? (
        <NativeModuleDeliveryReading
          openRecords={visibleOpenDeliveryRecords}
          closedRecords={visibleClosedDeliveryRecords}
          recentlyClosedRecordId={recentlyClosedRecordId}
          formatAuditText={formatAuditText}
          onApplyAction={handleApplyAction}
          onDelete={handleDelete}
        />
      ) : isSchedule ? (
        <NativeModuleSchedule
          records={visibleRecords}
          scheduleMachineDrafts={scheduleMachineDrafts}
          scheduleMachineOptions={scheduleMachineOptions}
          onDraftChange={handleScheduleMachineDraftChange}
          onUpdate={handleScheduleMachineUpdate}
          onDelete={handleDelete}
        />
      ) : isMachineChecklist ? (
        <NativeModuleMachines
          records={visibleMachineChecklistRecords}
          onApplyAction={handleApplyAction}
          onDelete={handleDelete}
          onToggle={handleMachineChecklistToggle}
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
          onDelete={handleDelete}
        />
      )}
    </SurfaceCard>
  )
}

export default NativeModuleRecordsSection
