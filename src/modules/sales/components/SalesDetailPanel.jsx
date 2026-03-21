import { formatCurrencyBRL } from '../../../services/commerce'
import { printSaleTicket } from '../../../services/commercePrint'
import { getSaleStatusMeta } from '../../../services/sales'
import { formatDateTime } from './salesModuleHelpers'
import EmptyState from '../../../components/ui/EmptyState';

function SalesDetailPanel({
  selectedSale,
  isLoading,
  requestedSaleId,
  canWrite,
  acting,
  onReverse,
  onCancel,
}) {
  const statusMeta = selectedSale ? getSaleStatusMeta(selectedSale.domainStatus) : null
  const canMutateSale = Boolean(acting || !canWrite || selectedSale?.domainStatus !== 'POSTED') === false

  return (
    <div className="sales-domain__detail-shell">
      <div className="sales-domain__detail-header">
        <div>
          <p className="text-section-title">Detalhe da Venda</p>
          <p className="text-body">Resumo, publicacao e rastreio da venda.</p>
        </div>

        {selectedSale ? (
          <div className="sales-domain__detail-actions">
            <button
              type="button"
              className="ui-button ui-button--ghost"
              onClick={() => printSaleTicket(selectedSale)}
            >
              Imprimir venda
            </button>
            {canMutateSale ? (
              <>
                <button
                  type="button"
                  className="ui-button ui-button--warning"
                  onClick={onReverse}
                >
                  Estornar venda
                </button>
                <button
                  type="button"
                  className="ui-button ui-button--danger"
                  onClick={onCancel}
                >
                  Cancelar venda
                </button>
              </>
            ) : (
              <p className="orders-domain__action-empty sales-domain__action-empty">
                Sem acoes pendentes para esta venda.
              </p>
            )}
          </div>
        ) : null}
      </div>

      {!selectedSale ? (
        <EmptyState
          message={isLoading ? 'Carregando...' : requestedSaleId ? 'Venda nao encontrada' : 'Selecione uma venda'}
        />
      ) : (
        <div className="sales-domain__detail">
          <div className="commerce-detail-band">
            <span className="ui-badge ui-badge--info">{selectedSale.channelLabel}</span>
            <span className={`ui-badge ${statusMeta.badgeClass}`}>{statusMeta.label}</span>
            <span className={`ui-badge ${selectedSale.stockPosted ? 'ui-badge--success' : 'ui-badge--warning'}`}>
              {selectedSale.stockPosted ? 'Estoque publicado' : 'Estoque pendente'}
            </span>
            <span className={`ui-badge ${selectedSale.financialPosted ? 'ui-badge--success' : 'ui-badge--special'}`}>
              {selectedSale.financialPosted ? 'Financeiro publicado' : 'Financeiro pendente'}
            </span>
          </div>

          <div className="sales-domain__detail-grid">
            <div className="sales-domain__detail-card">
              <span>Venda</span>
              <strong>{selectedSale.number}</strong>
              <small>{selectedSale.code}</small>
            </div>
            <div className="sales-domain__detail-card">
              <span>Cliente</span>
              <strong>{selectedSale.customerSnapshot?.name || 'Cliente avulso'}</strong>
              <small>{selectedSale.customerSnapshot?.phone || 'Sem telefone'}</small>
            </div>
            <div className="sales-domain__detail-card">
              <span>Canal</span>
              <strong>{selectedSale.channelLabel}</strong>
              <small>{selectedSale.source === 'ORDER' ? `Pedido ${selectedSale.orderId ?? '-'}` : 'Venda direta'}</small>
            </div>
            <div className="sales-domain__detail-card">
              <span>Status</span>
              <strong>{statusMeta.label}</strong>
              <small>{selectedSale.stockPosted ? 'Estoque publicado' : 'Aguardando estoque'}</small>
            </div>
            <div className="sales-domain__detail-card">
              <span>Pagamento</span>
              <strong>{selectedSale.paymentMethodLabel}</strong>
              <small>{selectedSale.financialPosted ? 'Financeiro publicado' : 'Aguardando financeiro'}</small>
            </div>
            <div className="sales-domain__detail-card">
              <span>Criada em</span>
              <strong>{formatDateTime(selectedSale.createdAtDate ?? selectedSale.createdAt)}</strong>
              <small>Lancada em {formatDateTime(selectedSale.launchedAtDate ?? selectedSale.launchedAt)}</small>
            </div>
          </div>

          <div className="sales-domain__detail-panels">
            <div className="sales-domain__summary">
              <div className="sales-domain__summary-row"><span>Subtotal</span><strong>{formatCurrencyBRL(selectedSale.totals?.subtotal ?? 0)}</strong></div>
              <div className="sales-domain__summary-row"><span>Frete</span><strong>{formatCurrencyBRL(selectedSale.totals?.freight ?? 0)}</strong></div>
              <div className="sales-domain__summary-row"><span>Adicional</span><strong>{formatCurrencyBRL(selectedSale.totals?.extraAmount ?? 0)}</strong></div>
              <div className="sales-domain__summary-row"><span>Desconto</span><strong>{formatCurrencyBRL(selectedSale.totals?.discountValue ?? 0)}</strong></div>
              <div className="sales-domain__summary-row sales-domain__summary-row--total"><span>Total final</span><strong>{formatCurrencyBRL(selectedSale.totals?.total ?? 0)}</strong></div>
            </div>

            <div className="sales-domain__notes">
              <span className="sales-domain__notes-label">Entrega</span>
              <strong>{selectedSale.address?.addressLine || 'Endereco nao informado'}</strong>
              <p>{selectedSale.address?.neighborhood || 'Bairro nao informado'}</p>
              <p>{selectedSale.address?.reference || 'Sem referencia'}</p>
              <p>{selectedSale.address?.complement || 'Sem complemento'}</p>
            </div>
          </div>

          <div className="sales-domain__detail-panels">
            <div className={`sales-domain__timeline-card${selectedSale.domainStatus !== 'POSTED' ? ' sales-domain__timeline-card--muted' : ''}`}>
              <span className="sales-domain__notes-label">Publicacao operacional</span>
              <div className="sales-domain__timeline-list">
                <div className="sales-domain__timeline-step">
                  <strong>Origem</strong>
                  <p>{selectedSale.source === 'ORDER' ? `Gerada do pedido ${selectedSale.orderId ?? '-'}` : 'Venda criada diretamente'}</p>
                </div>
                <div className="sales-domain__timeline-step">
                  <strong>Estoque</strong>
                  <p>{selectedSale.stockPosted ? 'Movimento aplicado no estoque' : 'Ainda nao publicado'}</p>
                </div>
                <div className="sales-domain__timeline-step">
                  <strong>Financeiro</strong>
                  <p>{selectedSale.financialPosted ? 'Receita registrada no financeiro' : 'Ainda nao publicado'}</p>
                </div>
                <div className="sales-domain__timeline-step">
                  <strong>Auditoria</strong>
                  <p>{selectedSale.launchedBy ? `Lancada por ${selectedSale.launchedBy.name ?? selectedSale.launchedBy.email ?? 'operador'}` : 'Sem operador informado'}</p>
                </div>
              </div>
            </div>

            <div className="sales-domain__notes">
              <span className="sales-domain__notes-label">Observacoes</span>
              <p>{selectedSale.notes || 'Nenhuma observacao registrada.'}</p>
              <p>{selectedSale.orderId ? `Pedido vinculado: ${selectedSale.orderId}` : 'Venda criada diretamente.'}</p>
            </div>
          </div>

          <div className="sales-domain__items-list">
            <div className="sales-domain__items-header">
              <p className="text-label">Itens da venda</p>
              <span className="ui-badge ui-badge--special">{selectedSale.items?.length ?? 0} itens</span>
            </div>
            {selectedSale.items?.map((item, index) => (
              <div key={`${item.productId || item.name}-${index}`} className="sales-domain__item-line">
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.quantity} x {formatCurrencyBRL(item.unitPrice)}</p>
                </div>
                <strong>{formatCurrencyBRL(item.totalPrice ?? item.total ?? 0)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesDetailPanel

