import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import CaixaStatusBar from '../../../components/caixa/CaixaStatusBar';
import PageTabs from '../../../components/common/PageTabs';
import SurfaceCard from '../../../components/common/SurfaceCard';
import FormRow from '../../../components/ui/FormRow';
import { useAuth } from '../../../contexts/AuthContext';
import { useStore } from '../../../contexts/StoreContext';
import { useToast } from '../../../hooks/useToast';
import { formatCurrencyBRL } from '../../../services/commerce';
import { subscribeToCouriers } from '../../../services/courierService';
import { appendAuditEvent } from '../../../services/localAudit';
import { loadResettableLocalRecords, saveResettableLocalRecords } from '../../../services/localAccess';
import {
  clearManualModuleRecords,
  deleteManualModuleRecord,
  saveManualModuleRecord,
  subscribeToManualModuleRecords,
} from '../../../services/manualModuleService';
import { printCashReceipt } from '../../../services/cashPrint';
import {
  createDefaultCashState,
  loadCashState,
  saveCashState,
  subscribeToCashState,
} from '../../../services/cashStateService';
import Select from '../../../components/ui/Select';
import EmptyState from '../../../components/ui/EmptyState';

const CASH_STORAGE_KEY = 'nexus-module-cash';
const CASH_STATE_STORAGE_KEY = 'nexus-module-cash-state';
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
    id: 'courier-withdrawal',
    label: 'Retirada de entregador',
    title: 'Registrar retirada de entregador',
    submitLabel: 'Registrar retirada',
    receiptLabel: 'Retirada de entregador',
    codePrefix: 'RET',
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

function buildCashRecord(tab, amount, note, operatorName, courierName = '') {
  const createdAt = new Date().toISOString();

  return {
    id: createCashId(),
    kind: tab.id,
    kindLabel: tab.receiptLabel,
    amount,
    amountLabel: formatCurrencyBRL(amount),
    note: note.trim(),
    operatorName,
    courierName: courierName.trim(),
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
      <EmptyState message="Nenhum lancamento de caixa hoje" />
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
                  {record.courierName ? <small>{record.courierName}</small> : null}
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
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabId = searchParams.get('tab') ?? CASH_TABS[0].id;
  const activeTab = CASH_TABS.find((tab) => tab.id === activeTabId) ?? CASH_TABS[0];
  const [records, setRecords] = useState(() => loadResettableLocalRecords(CASH_STORAGE_KEY, [], CASH_RESET_HOUR));
  const [cashState, setCashState] = useState(() => loadCashState(CASH_STATE_STORAGE_KEY, CASH_RESET_HOUR));
  const [couriers, setCouriers] = useState([]);
  const [selectedCourier, setSelectedCourier] = useState('');
  const [valueInput, setValueInput] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
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

  useEffect(() => {
    const unsubscribe = subscribeToCashState({
      storeId: currentStoreId,
      storageKey: CASH_STATE_STORAGE_KEY,
      resetHour: CASH_RESET_HOUR,
      onData(nextState) {
        setCashState(nextState);
      },
      onError() {
        setSyncMessage('Historico local ativo');
      },
    });

    return unsubscribe;
  }, [currentStoreId]);

  useEffect(() => subscribeToCouriers(
    currentStoreId,
    (nextCouriers) => {
      setCouriers(nextCouriers);
    },
    () => {
      setCouriers([]);
    },
  ), [currentStoreId]);

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
  const balanceDelta = useMemo(
    () =>
      records.reduce((sum, record) => {
        const amount = Number(record.amount ?? 0);

        if (record.kind === 'supply') {
          return sum + amount;
        }

        if (record.kind === 'withdrawal' || record.kind === 'courier-withdrawal') {
          return sum - amount;
        }

        return sum;
      }, 0),
    [records],
  );
  const courierOptions = useMemo(
    () => couriers
      .map((courier) => courier?.name?.trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, 'pt-BR')),
    [couriers],
  );
  const requiresCourier = activeTab.id === 'courier-withdrawal';
  const isCashOpen = cashState.status === 'aberto';
  const pendingCount = Number(cashState.pendingCount ?? 0) || 0;
  const closingDisabled = !isCashOpen || pendingCount > 0;

  useEffect(() => {
    if (!isCashOpen && activeTab.id !== 'opening') {
      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams);
        nextParams.set('tab', 'opening');
        return nextParams;
      });
      toast.warning('Abra o caixa primeiro');
    }
  }, [activeTab.id, isCashOpen, setSearchParams, toast]);

  useEffect(() => {
    if (!isCashOpen) {
      return;
    }

    const nextBalance = Number((Number(cashState.initialBalance ?? 0) + balanceDelta).toFixed(2));

    if (Math.abs(nextBalance - Number(cashState.currentBalance ?? 0)) < 0.001) {
      return;
    }

    const nextState = {
      ...cashState,
      currentBalance: nextBalance,
    };

    setCashState(nextState);
    saveCashState({
      storeId: currentStoreId,
      tenantId,
      storageKey: CASH_STATE_STORAGE_KEY,
      state: nextState,
      resetHour: CASH_RESET_HOUR,
    }).catch(() => {
      setSyncMessage('Historico local ativo');
    });
  }, [balanceDelta, cashState, currentStoreId, isCashOpen, tenantId]);

  function handleTabChange(tabId) {
    if (tabId !== 'opening' && !isCashOpen) {
      toast.warning('Abra o caixa primeiro');
      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams);
        nextParams.set('tab', 'opening');
        return nextParams;
      });
      return;
    }

    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set('tab', tabId);
      return nextParams;
    });
    setErrorMessage('');
    setConfirmAction(null);
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

  async function persistCashState(nextState) {
    setCashState(nextState);

    try {
      const wasSavedRemotely = await saveCashState({
        storeId: currentStoreId,
        tenantId,
        storageKey: CASH_STATE_STORAGE_KEY,
        state: nextState,
        resetHour: CASH_RESET_HOUR,
      });
      setSyncMessage(wasSavedRemotely ? '' : 'Historico local ativo');
    } catch (error) {
      console.error('Nao foi possivel sincronizar o estado do caixa.', error);
      setSyncMessage('Estado do caixa salvo localmente');
    }
  }

  function clearForm() {
    setSelectedCourier('');
    setValueInput('');
    setNote('');
    setErrorMessage('');
    setConfirmAction(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (activeTab.id !== 'opening' && activeTab.id !== 'closing' && !isCashOpen) {
      toast.warning('Abra o caixa primeiro');
      handleTabChange('opening');
      return;
    }

    const amount = parseCurrencyInput(valueInput);

    if (activeTab.id !== 'closing' && amount <= 0) {
      setErrorMessage('Informe um valor maior que zero.');
      return;
    }

    if (activeTab.id === 'opening' && isCashOpen) {
      setErrorMessage('O caixa ja esta aberto.');
      toast.warning('O caixa ja esta aberto');
      return;
    }

    if (requiresCourier && !selectedCourier.trim()) {
      setErrorMessage('Selecione o entregador da retirada.');
      return;
    }

    const operatorName = session?.operatorName ?? session?.displayName ?? 'Operador local';

    if (activeTab.id === 'opening') {
      setConfirmAction({
        type: 'opening',
        message: `Abrir com ${formatCurrencyBRL(amount)}?`,
        amount,
        operatorName,
      });
      return;
    }

    if (activeTab.id === 'closing') {
      if (!isCashOpen) {
        toast.warning('Abra o caixa primeiro');
        handleTabChange('opening');
        return;
      }

      if (pendingCount > 0) {
        toast.warning(`Resolva ${pendingCount} pendencia(s) antes`);
        return;
      }

      setConfirmAction({
        type: 'closing',
        message: 'Confirmar fechamento de caixa?',
        amount: Number(cashState.currentBalance ?? 0),
        operatorName,
      });
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    const nextRecord = buildCashRecord(activeTab, amount, note, operatorName, selectedCourier);

    try {
      await persistRecords([nextRecord, ...records], nextRecord);
      appendAuditEvent({
        module: 'Caixa',
        modulePath: 'cash',
        actor: operatorName,
        action: activeTab.submitLabel,
        target: nextRecord.receiptCode,
        details: [
          nextRecord.amountLabel,
          nextRecord.courierName ? `Entregador: ${nextRecord.courierName}` : '',
          nextRecord.note ? `Obs: ${nextRecord.note}` : '',
        ].filter(Boolean).join(' | '),
      });
      clearForm();
      toast.success(`${activeTab.receiptLabel} registrado`);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction) {
      return;
    }

    const operatorName = confirmAction.operatorName;
    setIsSaving(true);
    setErrorMessage('');

    try {
      if (confirmAction.type === 'opening') {
        const openingTab = CASH_TABS.find((tab) => tab.id === 'opening');
        const nextRecord = buildCashRecord(openingTab, confirmAction.amount, '', operatorName);
        const nextState = {
          status: 'aberto',
          openedAt: new Date().toISOString(),
          closedAt: '',
          initialBalance: confirmAction.amount,
          currentBalance: confirmAction.amount,
          pendingCount: 0,
          operationalDay: cashState.operationalDay,
        };

        await persistRecords([nextRecord, ...records], nextRecord);
        await persistCashState(nextState);
        appendAuditEvent({
          module: 'Caixa',
          modulePath: 'cash',
          actor: operatorName,
          action: 'Abertura de caixa',
          target: nextRecord.receiptCode,
          details: nextRecord.amountLabel,
        });
        toast.success(`Caixa aberto as ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(nextState.openedAt))}`);
        clearForm();
      }

      if (confirmAction.type === 'closing') {
        const closingTab = CASH_TABS.find((tab) => tab.id === 'closing');
        const nextRecord = buildCashRecord(closingTab, confirmAction.amount, note, operatorName);
        const nextState = {
          ...createDefaultCashState(CASH_RESET_HOUR),
          closedAt: new Date().toISOString(),
          currentBalance: confirmAction.amount,
        };

        await persistRecords([nextRecord, ...records], nextRecord);
        await persistCashState(nextState);
        appendAuditEvent({
          module: 'Caixa',
          modulePath: 'cash',
          actor: operatorName,
          action: 'Fechamento de caixa',
          target: nextRecord.receiptCode,
          details: nextRecord.amountLabel,
        });
        toast.success(`Caixa fechado as ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(nextState.closedAt))}`);
        clearForm();
        navigate('/dashboard');
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(recordId) {
    const targetRecord = records.find((record) => record.id === recordId);
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

    appendAuditEvent({
      module: 'Caixa',
      modulePath: 'cash',
      actor: session?.operatorName ?? session?.displayName ?? 'Operador local',
      action: 'Excluiu lancamento',
      target: targetRecord?.receiptCode ?? 'Lancamento de caixa',
      details: targetRecord?.amountLabel ?? '',
    });
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

    appendAuditEvent({
      module: 'Caixa',
      modulePath: 'cash',
      actor: session?.operatorName ?? session?.displayName ?? 'Operador local',
      action: 'Limpou historico do dia',
      target: 'Caixa',
      details: 'Historico operacional do dia foi reiniciado.',
    });
  }

    return (
    <div className="cash-module">
      <CaixaStatusBar
        cashState={cashState}
        onOpenCash={() => handleTabChange('opening')}
        onGoToClosing={() => handleTabChange('closing')}
        closingDisabled={closingDisabled}
        closingTooltip={pendingCount > 0 ? `Resolva ${pendingCount} pendencia(s) antes` : ''}
      />

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
          {activeTab.id === 'closing' ? (
            <div className="cash-module__closing-summary">
              <div className="cash-module__closing-row">
                <span>Entradas</span>
                <strong>{formatCurrencyBRL((totalAmountByTab.opening ?? 0) + (totalAmountByTab.supply ?? 0))}</strong>
              </div>
              <div className="cash-module__closing-row">
                <span>Saidas</span>
                <strong>{formatCurrencyBRL((totalAmountByTab.withdrawal ?? 0) + (totalAmountByTab['courier-withdrawal'] ?? 0))}</strong>
              </div>
              <div className="cash-module__closing-row cash-module__closing-row--total">
                <span>Saldo final</span>
                <strong>{formatCurrencyBRL(cashState.currentBalance ?? 0)}</strong>
              </div>
            </div>
          ) : (
            <FormRow className="cash-module__form-row">
              {requiresCourier ? (
                <div className="ui-field cash-module__row-field cash-module__row-field--courier">
                  <label className="ui-label" htmlFor="cash-courier">
                    Entregador
                  </label>
                  <Select
                    id="cash-courier"
                    className="ui-select"
                    value={selectedCourier}
                    onChange={(event) => setSelectedCourier(event.target.value)}
                  >
                    <option value="">Selecione o entregador</option>
                    {courierOptions.map((courierName) => (
                      <option key={courierName} value={courierName}>
                        {courierName}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}

              <div className="ui-field cash-module__row-field cash-module__row-field--value">
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

              {activeTab.id !== 'opening' ? (
                <div className="ui-field cash-module__row-field cash-module__row-field--note">
                  <label className="ui-label" htmlFor="cash-note">
                    Observacao
                  </label>
                  <input
                    id="cash-note"
                    className="ui-input"
                    placeholder="Observacao"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </div>
              ) : null}

              <button
                type="button"
                className="ui-button ui-button--ghost"
                onClick={clearForm}
              >
                Limpar
              </button>
              <button
                type="submit"
                className="ui-button ui-button--primary"
                disabled={isSaving || (activeTab.id !== 'opening' && !isCashOpen) || (activeTab.id === 'opening' && isCashOpen)}
              >
                {activeTab.submitLabel}
              </button>
            </FormRow>
          )}

          {confirmAction ? (
            <div className="cash-module__confirm">
              <div className="cash-module__confirm-copy">
                <strong>{confirmAction.message}</strong>
                {confirmAction.type === 'closing' ? (
                  <span>Resumo visivel acima. O fechamento nao podera ser desfeito no turno atual.</span>
                ) : null}
              </div>
              <div className="cash-module__form-actions">
                <button type="button" className="ui-button ui-button--ghost" onClick={() => setConfirmAction(null)}>
                  Cancelar
                </button>
                <button type="button" className="ui-button ui-button--primary" onClick={handleConfirmAction} disabled={isSaving}>
                  Confirmar
                </button>
              </div>
            </div>
          ) : null}
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


