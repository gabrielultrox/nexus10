function NativeModuleStatusBar({
  syncModeLabel,
  syncModeTone,
  pendingCount,
  resetLabel,
  activityLabel,
  onRetrySync,
  retryDisabled,
}) {
  return (
    <section className="native-module__status-bar">
      <article className="native-module__status-card">
        <span className="native-module__status-label">Sincronizacao</span>
        <div className="native-module__status-value-row">
          <strong className="native-module__status-value">{syncModeLabel}</strong>
          <span className={`ui-badge ${syncModeTone}`}>{syncModeLabel}</span>
        </div>
      </article>

      <article className="native-module__status-card">
        <span className="native-module__status-label">Pendencias</span>
        <div className="native-module__status-value-row">
          <strong className="native-module__status-value">{pendingCount}</strong>
          <span className={`ui-badge ${pendingCount > 0 ? 'ui-badge--warning' : 'ui-badge--success'}`}>
            {pendingCount > 0 ? 'Fila ativa' : 'Em dia'}
          </span>
        </div>
      </article>

      <article className="native-module__status-card">
        <span className="native-module__status-label">Reset operacional</span>
        <div className="native-module__status-value-row">
          <strong className="native-module__status-value">{resetLabel}</strong>
          <span className="ui-badge ui-badge--info">Turno</span>
        </div>
      </article>

      <article className="native-module__status-card native-module__status-card--actions">
        <span className="native-module__status-label">Contingencia</span>
        <div className="native-module__status-value-row">
          <strong className="native-module__status-value native-module__status-value--small">{activityLabel}</strong>
        </div>
        <button
          type="button"
          className="ui-button ui-button--secondary"
          onClick={onRetrySync}
          disabled={retryDisabled}
        >
          Reenviar pendencias
        </button>
      </article>
    </section>
  )
}

export default NativeModuleStatusBar
