import { useEffect, useMemo, useState } from 'react';

import MetricCard from '../../../components/common/MetricCard';
import SurfaceCard from '../../../components/common/SurfaceCard';
import { useStore } from '../../../contexts/StoreContext';
import { firebaseReady } from '../../../services/firebase';
import { buildPdvReportCsv, buildPdvReportData, subscribeToReportSources } from '../../../services/reports';
import { playError, playSuccess } from '../../../services/soundManager';
import ReportBarChart from './ReportBarChart';
import ReportStatList from './ReportStatList';

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value ?? 0));
}

function formatInteger(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value ?? 0));
}

function getDefaultStartDate() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function getDefaultEndDate() {
  return new Date().toISOString().slice(0, 10);
}

function downloadCsvFile(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

function PosReportsModule() {
  const { currentStoreId } = useStore();
  const [sales, setSales] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [financialEntries, setFinancialEntries] = useState([]);
  const [loadedSources, setLoadedSources] = useState({
    sales: false,
    orders: false,
    products: false,
    financialEntries: false,
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(getDefaultEndDate);

  useEffect(() => {
    if (!firebaseReady || !currentStoreId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setErrorMessage('');
    setFeedbackMessage('');
    setSales([]);
    setOrders([]);
    setProducts([]);
    setFinancialEntries([]);
    setLoadedSources({
      sales: false,
      orders: false,
      products: false,
      financialEntries: false,
    });

    const unsubscribe = subscribeToReportSources(currentStoreId, {
      onSales: (nextSales) => {
        setSales(nextSales);
        setLoadedSources((current) => ({ ...current, sales: true }));
      },
      onOrders: (nextOrders) => {
        setOrders(nextOrders);
        setLoadedSources((current) => ({ ...current, orders: true }));
      },
      onProducts: (nextProducts) => {
        setProducts(nextProducts);
        setLoadedSources((current) => ({ ...current, products: true }));
      },
      onFinancialEntries: (nextEntries) => {
        setFinancialEntries(nextEntries);
        setLoadedSources((current) => ({ ...current, financialEntries: true }));
      },
      onError: (error) => {
        setErrorMessage(error.message);
        setLoading(false);
      },
    });

    return unsubscribe;
  }, [currentStoreId]);

  useEffect(() => {
    if (Object.values(loadedSources).every(Boolean)) {
      setLoading(false);
    }
  }, [loadedSources]);

  const reportData = useMemo(() => buildPdvReportData({
    sales,
    orders,
    products,
    financialEntries,
    startDate,
    endDate,
  }), [endDate, financialEntries, orders, products, sales, startDate]);

  const reconciliationDelta = Number(
    (reportData.totals.totalSold - reportData.totals.activeFinancialSales).toFixed(2),
  );

  const metrics = [
    {
      label: 'Total vendido',
      value: formatCurrency(reportData.totals.totalSold),
      meta: 'vendas concluidas no periodo filtrado',
      badgeText: 'receita',
      badgeClass: 'ui-badge--success',
    },
    {
      label: 'Ticket medio',
      value: formatCurrency(reportData.totals.averageTicket),
      meta: 'media por venda concluida',
      badgeText: 'pdv',
      badgeClass: 'ui-badge--info',
    },
    {
      label: 'Quantidade de vendas',
      value: formatInteger(reportData.totals.salesCount),
      meta: 'base real da store atual',
      badgeText: 'real',
      badgeClass: 'ui-badge--special',
    },
    {
      label: 'Lucro estimado',
      value: formatCurrency(reportData.totals.estimatedProfit),
      meta: 'calculado com custo dos produtos disponiveis',
      badgeText: 'margem',
      badgeClass: 'ui-badge--warning',
    },
  ];

  function handleExportCsv() {
    try {
      if (reportData.exportRows.length === 0) {
        throw new Error('Nao ha vendas no periodo para exportar.');
      }

      const csv = buildPdvReportCsv(reportData);
      downloadCsvFile(csv, `relatorio-pdv-${startDate || 'inicio'}-${endDate || 'fim'}.csv`);
      setFeedbackMessage('Exportacao CSV preparada com os dados reais do periodo.');
      setErrorMessage('');
      playSuccess();
    } catch (error) {
      setFeedbackMessage('');
      setErrorMessage(error.message);
      playError();
    }
  }

  if (!firebaseReady) {
    return (
      <SurfaceCard title="Relatorios do PDV">
        <div className="entity-empty-state">
          <p className="text-section-title">Firebase nao configurado</p>
          <p className="text-body">Configure as variaveis VITE_FIREBASE_* para usar os relatorios reais.</p>
        </div>
      </SurfaceCard>
    );
  }

  if (!currentStoreId) {
    return (
      <SurfaceCard title="Relatorios do PDV">
        <div className="entity-empty-state">
          <p className="text-section-title">Nenhuma store ativa</p>
          <p className="text-body">Selecione uma store para carregar vendas, pedidos, produtos e financeiro.</p>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <section className="entity-module pos-reports-module">
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

      <SurfaceCard title="Filtro e exportacao">
        <div className="entity-toolbar pos-reports-toolbar">
          <div className="ui-field">
            <label className="ui-label" htmlFor="pos-reports-start-date">Inicio</label>
            <input
              id="pos-reports-start-date"
              className="ui-input"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor="pos-reports-end-date">Fim</label>
            <input
              id="pos-reports-end-date"
              className="ui-input"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>

          <div className="pos-reports-toolbar__actions">
            <button type="button" className="ui-button ui-button--secondary" onClick={handleExportCsv}>
              Exportar CSV
            </button>
          </div>
        </div>
      </SurfaceCard>

      {feedbackMessage ? <div className="auth-error auth-error--success">{feedbackMessage}</div> : null}
      {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

      {loading ? (
        <SurfaceCard title="Relatorios em tempo real">
          <div className="entity-empty-state">
            <p className="text-section-title">Carregando metricas reais...</p>
          </div>
        </SurfaceCard>
      ) : (
        <>
          <div className="pos-reports-layout">
            <SurfaceCard title="Consistencia com financeiro">
              <div className="pos-reports-reconciliation">
                <div className="pos-reports-reconciliation__row">
                  <span>Total vendido</span>
                  <strong>{formatCurrency(reportData.totals.totalSold)}</strong>
                </div>
                <div className="pos-reports-reconciliation__row">
                  <span>Entradas ativas no financeiro</span>
                  <strong>{formatCurrency(reportData.totals.activeFinancialSales)}</strong>
                </div>
                <div className="pos-reports-reconciliation__row">
                  <span>Diferenca</span>
                  <strong className={reconciliationDelta === 0 ? 'text-success' : 'text-danger'}>
                    {formatCurrency(reconciliationDelta)}
                  </strong>
                </div>
              </div>
            </SurfaceCard>

            <ReportStatList
              title="Produtos mais vendidos"
              items={reportData.topProducts}
              valueFormatter={(item) => `${formatInteger(item.quantity)} un.`}
              metaFormatter={(item) => `Receita ${formatCurrency(item.revenue)}`}
            />
          </div>

          <div className="pos-reports-chart-grid">
            <ReportBarChart
              title="Vendas por dia"
              items={reportData.salesByDay}
              valueFormatter={(item) => formatCurrency(item.total)}
              metaFormatter={(item) => `${formatInteger(item.count)} vendas`}
            />

            <ReportBarChart
              title="Formas de pagamento"
              items={reportData.paymentMethods}
              valueFormatter={(item) => formatCurrency(item.total)}
              metaFormatter={(item) => `${formatInteger(item.count)} vendas`}
            />
          </div>

          <div className="pos-reports-chart-grid">
            <ReportBarChart
              title="Pedidos por status"
              items={reportData.orderStatuses}
              valueFormatter={(item) => formatInteger(item.value)}
              metaFormatter={(item) => `${formatInteger(item.value)} pedidos`}
            />

            <SurfaceCard title="Resumo diario">
              {reportData.salesByDay.length === 0 ? (
                <div className="entity-empty-state">
                  <p className="text-section-title">Sem vendas no periodo</p>
                  <p className="text-body">Ajuste o periodo para gerar a leitura diaria do PDV.</p>
                </div>
              ) : (
                <div className="entity-table-wrap">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Dia</th>
                        <th>Vendas</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.salesByDay.map((day) => (
                        <tr key={day.id}>
                          <td className="ui-table__cell--strong">{day.label}</td>
                          <td className="ui-table__cell--numeric">{formatInteger(day.count)}</td>
                          <td className="ui-table__cell--numeric">{formatCurrency(day.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SurfaceCard>
          </div>
        </>
      )}
    </section>
  );
}

export default PosReportsModule;
