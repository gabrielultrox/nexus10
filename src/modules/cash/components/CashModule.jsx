import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import PageTabs from '../../../components/common/PageTabs';
import SurfaceCard from '../../../components/common/SurfaceCard';
import { useAuth } from '../../../contexts/AuthContext';
import { useStore } from '../../../contexts/StoreContext';
import { formatCurrencyBRL } from '../../../services/commerce';
import { loadResettableLocalRecords, saveResettableLocalRecords } from '../../../services/localAccess';
import {
  clearManualModuleRecords,
  deleteManualModuleRecord,
  saveManualModuleRecord,
  subscribeToManualModuleRecords,
} from '../../../services/manualModuleService';
import { printCashReceipt } from '../../../services/cashPrint';

const CASH_STORAGE_KEY = 'nexus-module-cash';
const CASH_RESET_HOUR = 3;

const CASH_TABS = [
  {
    id: 'opening',
    label: 'Abertura de caixa',
    title: 'Registrar abertura de caixa',
    submitLabel: 'Registrar abertura',
    receiptLabel: 'Abertura de caixa',
    codePrefix: 'ABR',
  },
  {
    id: 'withdrawal',
    label: 'Sangria',
    title: 'Registrar sangria',
    submitLabel: 'Registrar sangria',
    receiptLabel: 'Sangria',
    codePrefix: 'SAN',
  },
  {
    id: 'supply',
    label: 'Suprimento',
    title: 'Registrar suprimento',
    submitLabel: 'Registrar suprimento',
    receiptLabel: 'Suprimento',
    codePrefix: 'SUP',
  },
  {
    id: 'closing',
    label: 'Fechamento de caixa',
    title: 'Registrar fechamento de caixa',
    submitLabel: 'Registrar fechamento',
    receiptLabel: 'Fechamento de caixa',
    codePrefix: 'FEC',
  },
];

function createCashId() {
  return `cash-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function buildReceiptCode(prefix) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `${prefix}-${year}${month}${day}-${hours}${minutes}`;
}

function formatDateTime(value) {
  const normalized = new Date(value);

  if (Number.isNaN(normalized.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(normalized);
}

function parseCurrencyInput(value) {
  const normalized = String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrencyInput(value) {
  const digitsOnly = String(value ?? '').replace(/\D/g, '');

  if (!digitsOnly) {
    return '';
  }

  const amount = Number(digitsOnly) / 100;
  return amount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function sortRecords(records) {
  return [...records].sort((left, right) => {
    const leftTime = Date.parse(left?.createdAtClient ?? '') || 0;
    const rightTime = Date.parse(right?.createdAtClient ?? '') || 0;

    return rightTime - leftTime;
  });
}

function buildCashRecord(tab, amount, note, operatorName) {
  const createdAt = new Date().toISOString();

  return {
    id: createCashId(),
    kind: tab.id,
    kindLabel: tab.receiptLabel,
    amount,
    amountLabel: formatCurrencyBRL(amount),
    note: note.trim(),
    operatorName,
    receiptCode: buildReceiptCode(tab.codePrefix),
    createdAtClient: createdAt,
    updatedAtClient: createdAt,
  };
}

function CashMetricCard({ label, value, meta }) {
  return (
    <div className="ui-kpi-card cash-module__metric-card">
      <span className="ui-kpi-card__label">{label}</span>
      <strong className="ui-kpi-card__value">{value}</strong>
      <span className="ui-kpi-card__meta">{meta}</span>
    </div>
  );
}

function CashHistoryTable({ records, onPrint, onDelete }) {
  if (records.length === 0) {
    return (
      <div className="module-empty-state">
        <p className="module-empty-state__text">Nenhum lancamento de caixa hoje</p>
      </div>
    );
  }

  return (
    <div className="cash-module__history-wrap">
      <table className="ui-table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Valor</th>
            <th>Observacao</th>
            <th>Operador</th>
            <th>Data</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, rowIndex) => (
            <tr key={record.id} className="ui-table__row-enter" style={{ '--row-delay': `${Math.min(rowIndex * 40, 240)}ms` }}>
              <td className="ui-table__cell--strong">
                <div className="cash-module__history-type">
                  <span>{record.kindLabel}</span>
                  <small>{record.receiptCode}</small>
                </div>
              </td>
              <td className="ui-table__cell--numeric">{record.amountLabel}</td>
              <td className="ui-table__cell--muted">{record.note || 'Sem observacao'}</td>
              <td className="ui-table__cell--muted">{record.operatorName}</td>
              <td className="ui-table__cell--muted">{formatDateTime(record.createdAtClient)}</td>
              <td>
                <div className="cash-module__history-actions">
                  <button
                    type="button"
                    className="ui-button ui-button--ghost"
                    onClick={() => onPrint(record)}
                  >
                    Imprimir
                  </button>
                  <button
                    type="button"
                    className="native-module__delete-action"
                    onClick={() => onDelete(record.id)}
                    aria-label="Excluir lancamento"
                    title="Excluir"
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M6 2h4l.5 1H13v1H3V3h2.5L6 2Zm-1 4h1v6H5V6Zm3 0h1v6H8V6Zm3 0h-1v6h1V6Z" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CashModule() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabId = searchParams.get('tab') ?? CASH_TABS[0].id;
  const activeTab = CASH_TABS.find((tab) => tab.id === activeTabId) ?? CASH_TABS[0];
  const [records, setRecords] = useState(() => loadResettableLocalRecords(CASH_STORAGE_KEY, [], CASH_RESET_HOUR));
  const [valueInput, setValueInput] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const { session } = useAuth();
  const { currentStoreId, tenantId } = useStore();

  useEffect(() => {
    const unsubscribe = subscribeToManualModuleRecords({
      storeId: currentStoreId,
      modulePath: 'cash',
      storageKey: CASH_STORAGE_KEY,
      initialRecords: [],
      dailyResetHour: CASH_RESET_HOUR,
      onData(nextRecords) {
        setRecords(sortRecords(nextRecords));
      },
      onError() {
        setSyncMessage('Historico local ativo');
      },
    });

    return unsubscribe;
  }, [currentStoreId]);

  const totalAmountByTab = useMemo(() => {
    return CASH_TABS.reduce((accumulator, tab) => {
      const total = records
        .filter((record) => record.kind === tab.id)
        .reduce((sum, record) => sum + Number(record.amount ?? 0), 0);

      accumulator[tab.id] = total;
      return accumulator;
    }, {});
  }, [records]);

  const totalDayAmount = useMemo(
    () => records.reduce((sum, record) => sum + Number(record.amount ?? 0), 0),
    [records],
  );

  function handleTabChange(tabId) {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set('tab', tabId);
      return nextParams;
    });
    setErrorMessage('');
  }

  async function persistRecords(nextRecords, nextRecord = null) {
    const sortedRecords = sortRecords(nextRecords);
    setRecords(sortedRecords);
    saveResettableLocalRecords(CASH_STORAGE_KEY, sortedRecords, CASH_RESET_HOUR);

    if (!nextRecord) {
      return;
    }

    try {
      const wasSavedRemotely = await saveManualModuleRecord({
        storeId: currentStoreId,
        tenantId,
        modulePath: 'cash',
        dailyResetHour: CASH_RESET_HOUR,
        record: nextRecord,
      });
      setSyncMessage(wasSavedRemotely ? '' : 'Historico local ativo');
    } catch (error) {
      console.error('Nao foi possivel sincronizar o lancamento de caixa.', error);
      setSyncMessage('Lancamento salvo localmente');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const amount = parseCurrencyInput(valueInput);

    if (amount <= 0) {
      setErrorMessage('Informe um valor maior que zero.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    const nextRecord = buildCashRecord(
      activeTab,
      amount,
      note,
      session?.operatorName ?? session?.displayName ?? 'Operador local',
    );

    try {
      await persistRecords([nextRecord, ...records], nextRecord);
      setValueInput('');
      setNote('');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(recordId) {
    const nextRecords = records.filter((record) => record.id !== recordId);
    setRecords(nextRecords);
    saveResettableLocalRecords(CASH_STORAGE_KEY, nextRecords, CASH_RESET_HOUR);

    try {
      const wasDeletedRemotely = await deleteManualModuleRecord({
        storeId: currentStoreId,
        modulePath: 'cash',
        recordId,
      });
      setSyncMessage(wasDeletedRemotely ? '' : 'Historico local ativo');
    } catch (error) {
      console.error('Nao foi possivel remover o lancamento de caixa remotamente.', error);
      setSyncMessage('Exclusao mantida localmente');
    }
  }

  async function handleClearHistory() {
    setRecords([]);
    saveResettableLocalRecords(CASH_STORAGE_KEY, [], CASH_RESET_HOUR);

    try {
      const wasClearedRemotely = await clearManualModuleRecords({
        storeId: currentStoreId,
        modulePath: 'cash',
        storageKey: CASH_STORAGE_KEY,
        initialRecords: [],
        dailyResetHour: CASH_RESET_HOUR,
      });
      setSyncMessage(wasClearedRemotely ? '' : 'Historico limpo localmente');
    } catch (error) {
      console.error('Nao foi possivel limpar o historico remoto do caixa.', error);
      setSyncMessage('Historico limpo localmente');
    }
  }

  return (
    <div className="cash-module">
      <div className="card-grid cash-module__metrics">
        <CashMetricCard
          label="Movimentos do dia"
          value={String(records.length).padStart(2, '0')}
          meta="historico de caixa"
        />
        <CashMetricCard
          label={activeTab.label}
          value={formatCurrencyBRL(totalAmountByTab[activeTab.id] ?? 0)}
          meta="subtotal da aba"
        />
        <CashMetricCard
          label="Total do dia"
          value={formatCurrencyBRL(totalDayAmount)}
          meta="somatorio operacional"
        />
      </div>

      <PageTabs
        tabs={CASH_TABS}
        activeTab={activeTab.id}
        onTabChange={handleTabChange}
      />

      <SurfaceCard title={activeTab.title}>
        {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}
        {syncMessage ? <div className="cash-module__sync-note">{syncMessage}</div> : null}

        <form className="cash-module__form" onSubmit={handleSubmit}>
          <div className="cash-module__form-grid">
            <div className="ui-field">
              <label className="ui-label" htmlFor="cash-value">
                Valor
              </label>
              <input
                id="cash-value"
                className="ui-input"
                inputMode="decimal"
                placeholder="0,00"
                value={valueInput}
                onChange={(event) => setValueInput(formatCurrencyInput(event.target.value))}
              />
            </div>

            <div className="ui-field cash-module__form-field--wide">
              <label className="ui-label" htmlFor="cash-note">
                Observacao
              </label>
              <textarea
                id="cash-note"
                className="ui-textarea"
                placeholder="Ex: conferido com operador, fundo inicial, retirada de excesso"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>

          <div className="cash-module__form-actions">
            <button
              type="button"
              className="ui-button ui-button--ghost"
              onClick={() => {
                setValueInput('');
                setNote('');
                setErrorMessage('');
              }}
            >
              Limpar
            </button>
            <button type="submit" className="ui-button ui-button--primary" disabled={isSaving}>
              {activeTab.submitLabel}
            </button>
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard title="Historico de caixa">
        <div className="cash-module__history-toolbar">
          <span className="cash-module__history-counter">
            {`${records.length} visiveis | ${records.length} no dia`}
          </span>

          <div className="cash-module__history-toolbar-actions">
            {records.length > 0 ? (
              <button
                type="button"
                className="ui-button ui-button--ghost"
                onClick={handleClearHistory}
              >
                Limpar historico
              </button>
            ) : null}
          </div>
        </div>

        <CashHistoryTable
          records={records}
          onPrint={printCashReceipt}
          onDelete={handleDelete}
        />
      </SurfaceCard>
    </div>
  );
}

export default CashModule;
