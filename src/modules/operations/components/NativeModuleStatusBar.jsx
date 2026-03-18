function NativeModuleStatusBar({
  syncModeLabel,
  syncModeTone,
  pendingCount,
  resetLabel,
  activityLabel,
  isOnline,
  localOnlyMode,
  onRetrySync,
  onToggleLocalMode,
  retryDisabled,
}) {
  const syncPrimaryLabel = localOnlyMode ? 'Local' : 'Compartilhada'
  const networkPrimaryLabel = isOnline ? 'Online' : 'Offline'
  const shouldShow = localOnlyMode || !isOnline || pendingCount > 0

  if (!shouldShow) {
    return null
  }

  return (
    <section className="native-module__status-bar">
      <div className="native-module__status-line">
        <article className="native-module__status-item">
          <span className={`native-module__status-dot ${syncModeTone}`.replace('ui-badge', 'native-module__status-dot--')} />
          <span className="native-module__status-item-label">Sincronizacao</span>
          <strong className="native-module__status-item-value">{syncPrimaryLabel} · {syncModeLabel}</strong>
        </article>

        <article className="native-module__status-item">
          <span className={`native-module__status-dot ${isOnline ? 'native-module__status-dot--success' : 'native-module__status-dot--danger'}`} />
          <span className="native-module__status-item-label">Conexao</span>
          <strong className="native-module__status-item-value">{networkPrimaryLabel}</strong>
        </article>

        <article className="native-module__status-item">
          <span className={`native-module__status-dot ${pendingCount > 0 ? 'native-module__status-dot--warning' : 'native-module__status-dot--success'}`} />
          <span className="native-module__status-item-label">Pendencias</span>
          <strong className="native-module__status-item-value">{pendingCount}</strong>
        </article>

        <article className="native-module__status-item">
          <span className="native-module__status-dot native-module__status-dot--info" />
          <span className="native-module__status-item-label">Reset</span>
          <strong className="native-module__status-item-value">{resetLabel}</strong>
        </article>
      </div>

      <article className="native-module__status-actions">
        <span className="native-module__status-inline-message">{activityLabel}</span>
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
      </article>
    </section>
  )
}

export default NativeModuleStatusBar
