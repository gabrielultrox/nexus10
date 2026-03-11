function DashboardFilters({ startDate, endDate, onChange, onSetPreset }) {
  return (
    <section className="dashboard-filters">
      <div className="dashboard-filters__fields">
        <div className="ui-field">
          <label className="ui-label" htmlFor="dashboard-start-date">Inicio</label>
          <input
            id="dashboard-start-date"
            className="ui-input"
            type="date"
            value={startDate}
            onChange={(event) => onChange('startDate', event.target.value)}
          />
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor="dashboard-end-date">Fim</label>
          <input
            id="dashboard-end-date"
            className="ui-input"
            type="date"
            value={endDate}
            onChange={(event) => onChange('endDate', event.target.value)}
          />
        </div>
      </div>

      <div className="dashboard-filters__actions">
        <button type="button" className="ui-button ui-button--ghost" onClick={() => onSetPreset('today')}>
          Hoje
        </button>
        <button type="button" className="ui-button ui-button--ghost" onClick={() => onSetPreset('7d')}>
          7 dias
        </button>
        <button type="button" className="ui-button ui-button--secondary" onClick={() => onSetPreset('30d')}>
          30 dias
        </button>
      </div>
    </section>
  );
}

export default DashboardFilters;
