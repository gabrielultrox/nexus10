import { formatCurrencyBRL } from '../../../services/commerce';
import { getSaleStatusMeta } from '../../../services/sales';
import { formatDateTime } from './salesModuleHelpers';

function SalesDetailPanel({ selectedSale, canWrite, acting, onReverse, onCancel }) {
  return (
    <div className="sales-domain__detail-shell">
      <div className="sales-domain__detail-header">
        <div>
          <p className="text-section-title">Detalhe da Venda</p>
          <p className="text-body">Consulte o efeito operacional e financeiro da venda selecionada.</p>
        </div>

        {selectedSale ? (
          <div className="sales-domain__detail-actions">
            <button type="button" className="ui-button ui-button--warning" onClick={onReverse} disabled={acting || !canWrite || selectedSale.domainStatus !== 'POSTED'}>
              Estornar venda
            </button>
            <button type="button" className="ui-button ui-button--danger" onClick={onCancel} disabled={acting || !canWrite || selectedSale.domainStatus !== 'POSTED'}>
              Cancelar venda
            </button>
          </div>
        ) : null}
      </div>

      {!selectedSale ? (
        <div className="entity-empty-state">
          <p className="text-section-title">Selecione uma venda</p>
          <p className="text-body">O detalhe completo aparece aqui assim que uma venda for escolhida.</p>
        </div>
      ) : (
        <div className="sales-domain__detail">
          <div className="sales-domain__detail-grid">
            <div className="sales-domain__detail-card"><span>Venda</span><strong>{selectedSale.number}</strong><small>{selectedSale.code}</small></div>
            <div className="sales-domain__detail-card"><span>Cliente</span><strong>{selectedSale.customerSnapshot?.name || 'Cliente avulso'}</strong><small>{selectedSale.customerSnapshot?.phone || 'Sem telefone'}</small></div>
            <div className="sales-domain__detail-card"><span>Canal</span><strong>{selectedSale.channelLabel}</strong><small>{selectedSale.source === 'ORDER' ? `Pedido ${selectedSale.orderId ?? '-'}` : 'Venda direta'}</small></div>
            <div className="sales-domain__detail-card"><span>Status</span><strong>{getSaleStatusMeta(selectedSale.domainStatus).label}</strong><small>{selectedSale.stockPosted ? 'Estoque publicado' : 'Estoque pendente'}</small></div>
            <div className="sales-domain__detail-card"><span>Pagamento</span><strong>{selectedSale.paymentMethodLabel}</strong><small>{selectedSale.financialPosted ? 'Financeiro publicado' : 'Financeiro pendente'}</small></div>
            <div className="sales-domain__detail-card"><span>Criada em</span><strong>{formatDateTime(selectedSale.createdAtDate ?? selectedSale.createdAt)}</strong><small>Lancada em {formatDateTime(selectedSale.launchedAtDate ?? selectedSale.launchedAt)}</small></div>
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

          <div className="sales-domain__notes">
            <span className="sales-domain__notes-label">Observacoes</span>
            <p>{selectedSale.notes || 'Nenhuma observacao registrada.'}</p>
            <p>{selectedSale.orderId ? `Pedido vinculado: ${selectedSale.orderId}` : 'Venda criada diretamente.'}</p>
          </div>

          <div className="sales-domain__items-list">
            <p className="text-label">Itens da venda</p>
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
  );
}

export default SalesDetailPanel;
