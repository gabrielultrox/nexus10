import { formatCurrencyBRL } from '../../services/commerce';

function formatStatusTime(value) {
  if (!value) {
    return '--:--';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function CaixaStatusBar({
  cashState,
  onOpenCash,
  onGoToClosing,
  closingDisabled = false,
  closingTooltip = '',
}) {
  const isOpen = cashState.status === 'aberto';
  const pendingCount = Number(cashState.pendingCount ?? 0) || 0;

  return (
    <div className="caixa-status-bar" role="status" aria-live="polite">
      <div className="caixa-status-bar__main">
        <span
          className={[
            'caixa-status-bar__dot',
            isOpen ? 'caixa-status-bar__dot--open' : 'caixa-status-bar__dot--closed',
          ].join(' ')}
          aria-hidden="true"
        />

        {isOpen ? (
          <>
            <strong className="caixa-status-bar__text">
              Caixa aberto desde {formatStatusTime(cashState.openedAt)}
            </strong>
            <span className="caixa-status-bar__balance">
              Saldo: {formatCurrencyBRL(cashState.currentBalance ?? 0)}
            </span>
            {pendingCount > 0 ? (
              <span className="ui-badge ui-badge--warning">
                {pendingCount} pendencia{pendingCount > 1 ? 's' : ''}
              </span>
            ) : null}
          </>
        ) : (
          <strong className="caixa-status-bar__text">Caixa fechado</strong>
        )}
      </div>

      <div className="caixa-status-bar__actions">
        {isOpen ? (
          <button
            type="button"
            className="ui-button ui-button--ghost"
            onClick={onGoToClosing}
            disabled={closingDisabled}
            title={closingDisabled ? closingTooltip : 'Ir para fechamento'}
          >
            Fechar caixa
          </button>
        ) : (
          <button type="button" className="ui-button ui-button--primary" onClick={onOpenCash}>
            Abrir caixa
          </button>
        )}
      </div>
    </div>
  );
}

export default CaixaStatusBar;
