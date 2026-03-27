function DashboardFilters({ startDate, endDate, onChange, onSetPreset }) {
  return (
    <form
      className="dashboard-filters"
      aria-label="Filtros do dashboard"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="dashboard-filters__copy">
        <strong className="dashboard-filters__title">Periodo operacional</strong>
      </div>

      <div className="dashboard-filters__fields-wrap">
        <fieldset className="dashboard-filters__fields">
          <legend className="ui-sr-only">Selecionar periodo operacional</legend>
          <div className="ui-field">
            <label className="ui-label ui-sr-only" htmlFor="dashboard-start-date">
              Data inicial
            </label>
            <input
              id="dashboard-start-date"
              className="ui-input"
              type="date"
              value={startDate}
              onChange={(event) => onChange('startDate', event.target.value)}
            />
          </div>

          <div className="ui-field">
            <label className="ui-label ui-sr-only" htmlFor="dashboard-end-date">
              Data final
            </label>
            <input
              id="dashboard-end-date"
              className="ui-input"
              type="date"
              value={endDate}
              onChange={(event) => onChange('endDate', event.target.value)}
            />
          </div>
        </fieldset>

        <div className="dashboard-filters__actions" role="group" aria-label="Atalhos de periodo">
          <button
            type="button"
            className="ui-button ui-button--ghost"
            onClick={() => onSetPreset('today')}
          >
            Hoje
          </button>
          <button
            type="button"
            className="ui-button ui-button--ghost"
            onClick={() => onSetPreset('7d')}
          >
            7 dias
          </button>
          <button
            type="button"
            className="ui-button ui-button--secondary"
            onClick={() => onSetPreset('30d')}
          >
            30 dias
          </button>
        </div>
      </div>
    </form>
  )
}

export default DashboardFilters
