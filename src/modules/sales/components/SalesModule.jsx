import { useEffect, useMemo, useState } from 'react';

import MetricCard from '../../../components/common/MetricCard';
import SurfaceCard from '../../../components/common/SurfaceCard';
import { useAuth } from '../../../contexts/AuthContext';
import { useStore } from '../../../contexts/StoreContext';
import { buildAuditActor, recordAuditLog } from '../../../services/auditLog';
import { firebaseReady } from '../../../services/firebase';
import { getSaleStatusMeta, subscribeToSales, updateSaleStatus } from '../../../services/sales';
import { playError, playSuccess } from '../../../services/soundManager';

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value ?? 0));
}

function formatDateTime(value) {
  if (!value) {
    return '--';
  }

  const dateValue = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateValue);
}

function isWithinPeriod(createdAt, startDate, endDate) {
  if (!createdAt) {
    return false;
  }

  const value = typeof createdAt?.toDate === 'function' ? createdAt.toDate() : new Date(createdAt);

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    if (value < start) {
      return false;
    }
  }

  if (endDate) {
    const end = new Date(`${endDate}T23:59:59`);
    if (value > end) {
      return false;
    }
  }

  return true;
}

function SalesModule() {
  const { can, session } = useAuth();
  const { currentStoreId } = useStore();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState(null);

  useEffect(() => {
    if (!firebaseReady || !currentStoreId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setErrorMessage('');

    const unsubscribe = subscribeToSales(
      currentStoreId,
      (nextSales) => {
        setSales(nextSales);
        setLoading(false);
        if (!selectedSaleId && nextSales.length > 0) {
          setSelectedSaleId(nextSales[0].id);
        }
      },
      (error) => {
        setErrorMessage(error.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [currentStoreId, selectedSaleId]);

  const visibleSales = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return sales.filter((sale) => {
      const matchesSearch = normalizedSearch.length === 0 || [
        sale.id,
        sale.orderId,
        sale.customerSnapshot?.name,
        sale.customerSnapshot?.phone,
        sale.paymentMethod,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);

      const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
      const matchesPeriod = isWithinPeriod(sale.createdAt, startDate, endDate);

      return matchesSearch && matchesStatus && matchesPeriod;
    });
  }, [endDate, sales, searchTerm, startDate, statusFilter]);

  const selectedSale = useMemo(
    () => visibleSales.find((sale) => sale.id === selectedSaleId) ?? visibleSales[0] ?? null,
    [selectedSaleId, visibleSales],
  );

  const metrics = useMemo(() => {
    const completedSales = sales.filter((sale) => sale.status === 'completed');
    const canceledSales = sales.filter((sale) => sale.status === 'canceled');
    const refundedSales = sales.filter((sale) => sale.status === 'refunded');
    const volume = completedSales.reduce((total, sale) => total + Number(sale.total ?? 0), 0);

    return [
      {
        label: 'Vendas',
        value: String(sales.length).padStart(2, '0'),
        meta: 'vendas reais da store atual',
        badgeText: 'real',
        badgeClass: 'ui-badge--info',
      },
      {
        label: 'Concluidas',
        value: String(completedSales.length).padStart(2, '0'),
        meta: 'prontas para financeiro e relatorios',
        badgeText: 'ok',
        badgeClass: 'ui-badge--success',
      },
      {
        label: 'Canceladas/estornadas',
        value: String(canceledSales.length + refundedSales.length).padStart(2, '0'),
        meta: 'requerem leitura de impacto financeiro',
        badgeText: 'revisao',
        badgeClass: 'ui-badge--warning',
      },
      {
        label: 'Volume concluido',
        value: formatCurrency(volume),
        meta: 'total das vendas concluidas',
        badgeText: 'financeiro',
        badgeClass: 'ui-badge--special',
      },
    ];
  }, [sales]);

  async function handleStatusChange(nextStatus) {
    if (!selectedSale || !currentStoreId) {
      return;
    }

    if (!can('sales:write')) {
      setErrorMessage('Seu perfil nao pode alterar o status de vendas.');
      playError();
      return;
    }

    setErrorMessage('');
    setFeedbackMessage('');

    try {
      await updateSaleStatus({
        storeId: currentStoreId,
        saleId: selectedSale.id,
        status: nextStatus,
      });
      await recordAuditLog({
        storeId: currentStoreId,
        tenantId: selectedSale.tenantId ?? null,
        actor: buildAuditActor(session),
        action: nextStatus === 'canceled' ? 'sale.canceled' : 'sale.refunded',
        entityType: 'sale',
        entityId: selectedSale.id,
        description: `Venda ${selectedSale.id} alterada para ${getSaleStatusMeta(nextStatus).label}.`,
      });

      setFeedbackMessage(`Venda ${selectedSale.id} atualizada para ${getSaleStatusMeta(nextStatus).label}.`);
      playSuccess();
    } catch (error) {
      setErrorMessage(error.message);
      playError();
    }
  }

  if (!firebaseReady) {
    return (
      <SurfaceCard title="Vendas">
        <div className="entity-empty-state">
          <p className="text-section-title">Firebase nao configurado</p>
          <p className="text-body">Configure as variaveis VITE_FIREBASE_* para usar persistencia real.</p>
        </div>
      </SurfaceCard>
    );
  }

  if (!currentStoreId) {
    return (
      <SurfaceCard title="Vendas">
        <div className="entity-empty-state">
          <p className="text-section-title">Nenhuma store ativa</p>
          <p className="text-body">Selecione uma store antes de operar o modulo de vendas.</p>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <section className="entity-module sales-module">
      <div className="card-grid">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            meta={metric.meta}
            badgeText={metric.badgeText}
            badgeClass={metric.badgeClass}
          />
        ))}
      </div>

      <SurfaceCard title="Filtro de vendas">
        <div className="entity-toolbar sales-toolbar">
          <div className="ui-field">
            <label className="ui-label" htmlFor="sales-search">Buscar</label>
            <input
              id="sales-search"
              className="ui-input"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Venda, pedido, cliente ou telefone"
            />
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor="sales-status">Status</label>
            <select id="sales-status" className="ui-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Todos</option>
              <option value="completed">Concluidas</option>
              <option value="canceled">Canceladas</option>
              <option value="refunded">Estornadas</option>
            </select>
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor="sales-start-date">Inicio</label>
            <input id="sales-start-date" className="ui-input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor="sales-end-date">Fim</label>
            <input id="sales-end-date" className="ui-input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
        </div>
      </SurfaceCard>

      {feedbackMessage ? <div className="auth-error auth-error--success">{feedbackMessage}</div> : null}
      {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

      <div className="sales-layout">
        <SurfaceCard title="Lista de vendas">
          {loading ? (
            <div className="entity-empty-state">
              <p className="text-section-title">Carregando vendas...</p>
            </div>
          ) : visibleSales.length === 0 ? (
            <div className="entity-empty-state">
              <p className="text-section-title">Nenhuma venda encontrada</p>
              <p className="text-body">Ajuste os filtros ou grave vendas no Firestore para visualizar este modulo.</p>
            </div>
          ) : (
            <div className="entity-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Venda</th>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Pagamento</th>
                    <th>Status</th>
                    <th>Criada em</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSales.map((sale) => {
                    const statusMeta = getSaleStatusMeta(sale.status);

                    return (
                      <tr
                        key={sale.id}
                        className={sale.id === selectedSale?.id ? 'entity-table__row--selected' : undefined}
                        onClick={() => setSelectedSaleId(sale.id)}
                      >
                        <td className="ui-table__cell--strong">{sale.id}</td>
                        <td>{sale.orderId || '-'}</td>
                        <td>{sale.customerSnapshot?.name || '-'}</td>
                        <td className="ui-table__cell--numeric">{formatCurrency(sale.total)}</td>
                        <td>{sale.paymentMethod}</td>
                        <td><span className={`ui-badge ${statusMeta.badgeClass}`}>{statusMeta.label}</span></td>
                        <td>{formatDateTime(sale.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard title="Detalhe da venda">
          {!selectedSale ? (
            <div className="entity-empty-state">
              <p className="text-section-title">Selecione uma venda</p>
              <p className="text-body">Os detalhes completos aparecem aqui.</p>
            </div>
          ) : (
            <div className="sales-detail">
              <div className="sales-detail__header">
                <div>
                  <p className="text-overline">Sale</p>
                  <h3 className="text-section-title">{selectedSale.id}</h3>
                  <p className="text-body">
                    Pedido origem: <strong>{selectedSale.orderId || 'Nao vinculado'}</strong>
                  </p>
                </div>
                <span className={`ui-badge ${getSaleStatusMeta(selectedSale.status).badgeClass}`}>
                  {getSaleStatusMeta(selectedSale.status).label}
                </span>
              </div>

              <div className="sales-detail__grid">
                <div className="sales-detail__metric">
                  <span>Cliente</span>
                  <strong>{selectedSale.customerSnapshot?.name || '-'}</strong>
                  <small>{selectedSale.customerSnapshot?.phone || '-'}</small>
                </div>
                <div className="sales-detail__metric">
                  <span>Pagamento</span>
                  <strong>{selectedSale.paymentMethod}</strong>
                  <small>{formatDateTime(selectedSale.createdAt)}</small>
                </div>
                <div className="sales-detail__metric">
                  <span>Total</span>
                  <strong>{formatCurrency(selectedSale.total)}</strong>
                  <small>Subtotal {formatCurrency(selectedSale.subtotal)}</small>
                </div>
              </div>

              <div className="sales-detail__summary">
                <div className="sales-detail__summary-row">
                  <span>Subtotal</span>
                  <strong>{formatCurrency(selectedSale.subtotal)}</strong>
                </div>
                <div className="sales-detail__summary-row">
                  <span>Desconto</span>
                  <strong>{formatCurrency(selectedSale.discount)}</strong>
                </div>
                <div className="sales-detail__summary-row">
                  <span>Frete</span>
                  <strong>{formatCurrency(selectedSale.shipping)}</strong>
                </div>
                <div className="sales-detail__summary-row">
                  <span>Total final</span>
                  <strong>{formatCurrency(selectedSale.total)}</strong>
                </div>
              </div>

              <div className="sales-detail__items">
                <p className="text-label">Itens</p>
                {selectedSale.items?.map((item) => (
                  <div key={item.id ?? item.name} className="sales-detail__item">
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.quantity} x {formatCurrency(item.unitPrice)}</p>
                    </div>
                    <strong>{formatCurrency(item.total)}</strong>
                  </div>
                ))}
              </div>

              <div className="sales-detail__actions">
                <button
                  type="button"
                  className="ui-button ui-button--danger"
                  onClick={() => handleStatusChange('canceled')}
                  disabled={selectedSale.status !== 'completed' || !can('sales:write')}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="ui-button ui-button--warning"
                  onClick={() => handleStatusChange('refunded')}
                  disabled={selectedSale.status !== 'completed' || !can('sales:write')}
                >
                  Estornar
                </button>
              </div>
            </div>
          )}
        </SurfaceCard>
      </div>
    </section>
  );
}

export default SalesModule;
