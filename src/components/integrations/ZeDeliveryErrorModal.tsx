import { Button, ErrorDisplay, Modal } from '../ui'
import type { IZeDeliveryLogRecord } from '../../services/zeDeliveryIntegration'

interface IZeDeliveryErrorModalProps {
  open: boolean
  log: IZeDeliveryLogRecord | null
  onClose: () => void
  onRetry: (log: IZeDeliveryLogRecord) => void
  retrying?: boolean
}

function getSuggestion(log: IZeDeliveryLogRecord | null) {
  const message = log?.summary?.error?.message?.toLowerCase() ?? ''

  if (message.includes('token') || message.includes('auth')) {
    return 'Verifique a sessao do scraper e as credenciais do Ze Delivery.'
  }

  if (message.includes('selector') || message.includes('scrape')) {
    return 'Revise os seletores do painel e confirme se a interface do Ze Delivery mudou.'
  }

  if (message.includes('timeout') || message.includes('network')) {
    return 'Valide conectividade, latencia e estabilidade antes de reenviar a sincronizacao.'
  }

  return 'Use Retry para forcar nova leitura e consulte os logs estruturados se a falha persistir.'
}

function ZeDeliveryErrorModal({
  open,
  log,
  onClose,
  onRetry,
  retrying = false,
}: IZeDeliveryErrorModalProps) {
  if (!log) {
    return null
  }

  const hasStructuredError = Boolean(log.summary?.error?.message)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Detalhes da sincronizacao · ${log.storeId}`}
      description={log.summary?.runId ?? log.id}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          <Button
            variant="primary"
            onClick={() => onRetry(log)}
            loading={retrying}
            loadingLabel="Executando retry"
          >
            Retry
          </Button>
        </>
      }
    >
      {hasStructuredError ? (
        <ErrorDisplay
          code="ZE_SYNC_ERROR"
          title="Falha registrada na sincronizacao"
          message={log.summary?.error?.message ?? 'Erro nao identificado.'}
          suggestion={getSuggestion(log)}
          variant="error"
        />
      ) : (
        <ErrorDisplay
          code="ZE_SYNC_INFO"
          title="Execucao concluida sem erro estruturado"
          message="Este registro nao possui stack trace persistida. O resumo abaixo mostra o payload salvo."
          suggestion="Use Retry se precisar forcar nova leitura."
          variant="warning"
        />
      )}

      <div className="ze-delivery-error-modal__meta">
        <div>
          <span>Timestamp</span>
          <strong>{log.createdAt ?? '--'}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{log.summary?.success === false ? 'Error' : 'Success'}</strong>
        </div>
        <div>
          <span>Duracao</span>
          <strong>
            {log.summary?.durationMs ? `${(log.summary.durationMs / 1000).toFixed(1)}s` : '--'}
          </strong>
        </div>
      </div>

      <section className="ze-delivery-error-modal__section">
        <h4>Stack trace</h4>
        <pre className="ze-delivery-error-modal__pre">
          {log.summary?.error?.stack ?? 'Stack trace indisponivel para este registro.'}
        </pre>
      </section>

      <section className="ze-delivery-error-modal__section">
        <h4>Resumo salvo</h4>
        <pre className="ze-delivery-error-modal__pre">
          {JSON.stringify(log.summary ?? {}, null, 2)}
        </pre>
      </section>
    </Modal>
  )
}

export default ZeDeliveryErrorModal
