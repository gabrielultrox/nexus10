import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import '../styles/dashboard.css';

import PageIntro from '../components/common/PageIntro';
import DashboardCharts from '../components/dashboard/DashboardCharts';
import DashboardFilters from '../components/dashboard/DashboardFilters';
import DashboardKpiGrid from '../components/dashboard/DashboardKpiGrid';
import DashboardOperationalSummary from '../components/dashboard/DashboardOperationalSummary';
import { useStore } from '../contexts/StoreContext';
import {
  buildDashboardData,
  getDefaultDashboardPeriod,
  loadDashboardOperationalSources,
  subscribeToDashboardSources,
} from '../services/dashboard';
import { firebaseReady } from '../services/firebase';

function formatDateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function DashboardPage() {
  const navigate = useNavigate();
  const { currentStoreId } = useStore();
  const [period, setPeriod] = useState(() => getDefaultDashboardPeriod());
  const [sales, setSales] = useState([]);
  const [orders, setOrders] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [financialEntries, setFinancialEntries] = useState([]);
  const [operationalSources, setOperationalSources] = useState(() => loadDashboardOperationalSources());
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    function refreshOperationalSources() {
      setOperationalSources(loadDashboardOperationalSources());
    }

    refreshOperationalSources();
    window.addEventListener('focus', refreshOperationalSources);
    document.addEventListener('visibilitychange', refreshOperationalSources);

    return () => {
      window.removeEventListener('focus', refreshOperationalSources);
      document.removeEventListener('visibilitychange', refreshOperationalSources);
    };
  }, []);

  useEffect(() => {
    if (!firebaseReady || !currentStoreId) {
      setSales([]);
      setOrders([]);
      setInventoryItems([]);
      setFinancialEntries([]);
      return undefined;
    }

    setErrorMessage('');

    return subscribeToDashboardSources(currentStoreId, {
      onSales: setSales,
      onOrders: setOrders,
      onInventoryItems: setInventoryItems,
      onFinancialEntries: setFinancialEntries,
      onError(error) {
        setErrorMessage(error.message ?? 'Nao foi possivel carregar o dashboard operacional.');
      },
    });
  }, [currentStoreId]);

  const { kpis, charts, operations } = useMemo(() => buildDashboardData({
    sales,
    orders,
    financialEntries,
    inventoryItems,
    startDate: period.startDate,
    endDate: period.endDate,
    operations: operationalSources,
  }), [financialEntries, inventoryItems, operationalSources, orders, period.endDate, period.startDate, sales]);

  function handlePeriodChange(field, value) {
    setPeriod((current) => ({
      ...(() => {
        const next = {
          ...current,
          [field]: value,
        };

        if (field === 'startDate' && next.endDate && value > next.endDate) {
          next.endDate = value;
        }

        if (field === 'endDate' && next.startDate && value < next.startDate) {
          next.startDate = value;
        }

        return next;
      })(),
    }));
  }

  function handlePresetChange(preset) {
    const endDate = new Date();
    const startDate = new Date();

    if (preset === 'today') {
      const today = formatDateInputValue(endDate);

      setPeriod({
        startDate: today,
        endDate: today,
      });
      return;
    }

    startDate.setDate(endDate.getDate() - (preset === '30d' ? 29 : 6));

    setPeriod({
      startDate: formatDateInputValue(startDate),
      endDate: formatDateInputValue(endDate),
    });
  }

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Overview"
        title="Dashboard Operacional"
        description="Indicadores, alertas e leitura rapida do turno."
      />

      <section className="dashboard-shell">
        <DashboardFilters
          startDate={period.startDate}
          endDate={period.endDate}
          onChange={handlePeriodChange}
          onSetPreset={handlePresetChange}
        />

        {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

        {operations.reminders?.map((reminder) => (
          <button
            key={reminder.id}
            type="button"
            className={`dashboard-alert dashboard-alert--${reminder.type}`}
            onClick={() => reminder.route && navigate(reminder.route)}
          >
            <span className="dashboard-alert__dot" aria-hidden="true" />
            <div className="dashboard-alert__copy">
              <strong>{reminder.title}</strong>
              <span>{reminder.message}</span>
            </div>
          </button>
        ))}

        <DashboardKpiGrid items={kpis} />
        <DashboardCharts charts={charts} />
        <DashboardOperationalSummary operations={operations} />
      </section>
    </div>
  );
}

export default DashboardPage;
