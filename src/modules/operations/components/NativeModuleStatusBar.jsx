function NativeModuleStatusBar({
  syncModeLabel,
  pendingCount,
  resetLabel,
  recordsCount,
  isOnline,
  localOnlyMode,
  errorMessage,
  onRetrySync,
  onToggleLocalMode,
  retryDisabled,
}) {
  const shouldShow = Boolean(errorMessage || localOnlyMode || !isOnline || pendingCount > 0)

  if (!shouldShow) {
    return null
  }

  const syncState = errorMessage
    ? 'Erro de sincronizacao'
    : localOnlyMode
      ? 'Somente local'
      : pendingCount > 0
        ? 'Pendencias em fila'
        : syncModeLabel

  const syncTone = errorMessage
    ? 'native-module__status-dot--danger'
    : localOnlyMode || pendingCount > 0
      ? 'native-module__status-dot--warning'
      : 'native-module__status-dot--success'

  return (
    <section className="native-module__status-bar">
      <div className="native-module__status-line">
        <article className="native-module__status-item">
          <span className={`native-module__status-dot ${syncTone}`} />
          <span className="native-module__status-item-label">Estado</span>
          <strong className="native-module__status-item-value">{syncState}</strong>
        </article>

        <article className="native-module__status-item">
          <span
            className={`native-module__status-dot ${isOnline ? 'native-module__status-dot--success' : 'native-module__status-dot--danger'}`}
          />
          <span className="native-module__status-item-label">Conexao</span>
          <strong className="native-module__status-item-value">
            {isOnline ? 'Online' : 'Offline'}
          </strong>
        </article>

        <article className="native-module__status-item">
          <span
            className={`native-module__status-dot ${pendingCount > 0 ? 'native-module__status-dot--warning' : 'native-module__status-dot--success'}`}
          />
          <span className="native-module__status-item-label">Pendencias</span>
          <strong className="native-module__status-item-value">{pendingCount}</strong>
        </article>

        <article className="native-module__status-item">
          <span className="native-module__status-dot native-module__status-dot--info" />
          <span className="native-module__status-item-label">Reset</span>
          <strong className="native-module__status-item-value">{resetLabel}</strong>
        </article>

        <article className="native-module__status-item">
          <span className="native-module__status-dot native-module__status-dot--info" />
          <span className="native-module__status-item-label">Registros</span>
          <strong className="native-module__status-item-value">{recordsCount} no dia</strong>
        </article>

        <div className="native-module__status-actions">
          <button
            type="button"
            className="native-module__status-action"
            onClick={onToggleLocalMode}
          >
            {localOnlyMode ? 'Compartilhado' : 'Somente local'}
          </button>
          <button
            type="button"
            className="native-module__status-action"
            onClick={onRetrySync}
            disabled={retryDisabled}
          >
            Reenviar
          </button>
        </div>
      </div>
    </section>
  )
}

export default NativeModuleStatusBar
