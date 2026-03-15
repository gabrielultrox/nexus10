function NativeModuleStatusBar({
  syncModeLabel,
  syncModeTone,
  pendingCount,
  resetLabel,
  activityLabel,
  isOnline,
  localOnlyMode,
  syncHistory,
  onRetrySync,
  onToggleLocalMode,
  retryDisabled,
}) {
  return (
    <section className="native-module__status-bar">
      <div className="native-module__status-grid">
        <article className="native-module__status-card">
          <span className="native-module__status-label">Sincronizacao</span>
          <div className="native-module__status-value-row">
            <strong className="native-module__status-value">{syncModeLabel}</strong>
            <span className={`ui-badge ${syncModeTone}`}>{syncModeLabel}</span>
          </div>
        </article>

        <article className="native-module__status-card">
          <span className="native-module__status-label">Conexao</span>
          <div className="native-module__status-value-row">
            <strong className="native-module__status-value">{isOnline ? 'Online' : 'Offline'}</strong>
            <span className={`ui-badge ${isOnline ? 'ui-badge--success' : 'ui-badge--danger'}`}>
              {localOnlyMode ? 'Modo local' : isOnline ? 'Conectado' : 'Sem rede'}
            </span>
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
      </div>

      <article className="native-module__status-card native-module__status-card--command">
        <div className="native-module__status-command-copy">
          <span className="native-module__status-label">Contingencia</span>
          <strong className="native-module__status-value native-module__status-value--small">{activityLabel}</strong>
          <div className="native-module__status-inline-badges">
            <span className={`ui-badge ${localOnlyMode ? 'ui-badge--warning' : syncModeTone}`}>
              {localOnlyMode ? 'Somente local' : 'Fluxo compartilhado'}
            </span>
            <span className={`ui-badge ${isOnline ? 'ui-badge--success' : 'ui-badge--danger'}`}>
              {isOnline ? 'Rede ativa' : 'Sem rede'}
            </span>
          </div>
        </div>

        <div className="native-module__status-command-actions">
          <button
            type="button"
            className="ui-button ui-button--ghost"
            onClick={onToggleLocalMode}
          >
            {localOnlyMode ? 'Voltar ao compartilhado' : 'Somente local'}
          </button>
          <button
            type="button"
            className="ui-button ui-button--secondary"
            onClick={onRetrySync}
            disabled={retryDisabled}
          >
            Reenviar pendencias
          </button>
        </div>

        <div className="native-module__status-command-history">
          <span className="native-module__status-label">Historico recente</span>
          {syncHistory.length === 0 ? (
            <strong className="native-module__status-value native-module__status-value--small">Sem reenvios recentes</strong>
          ) : (
            <div className="native-module__status-history">
              {syncHistory.map((entry) => (
                <div key={entry.id} className="native-module__status-history-item">
                  <strong>{entry.flushedCount} reenviado(s)</strong>
                  <span>{new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(entry.createdAt))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </article>
    </section>
  )
}

export default NativeModuleStatusBar
