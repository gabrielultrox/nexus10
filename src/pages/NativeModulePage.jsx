import { useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';

import PageIntro from '../components/common/PageIntro';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../contexts/StoreContext';
import MetricCard from '../components/common/MetricCard';
import SurfaceCard from '../components/common/SurfaceCard';
import { MANUAL_COURIER_STORAGE_KEY, subscribeToCouriers } from '../services/courierService';
import { firebaseReady } from '../services/firebase';
import { appendAuditEvent, loadAuditEvents } from '../services/localAudit';
import {
  loadLocalRecords,
  loadResettableLocalRecords,
  resetLocalRecordsNow,
  saveLocalRecords,
  saveResettableLocalRecords,
} from '../services/localRecords';
import { storeUserOptions } from '../services/localUsers';
import { getManualModuleConfig } from '../services/manualModuleConfig';
import {
  clearManualModuleRecords,
  deleteManualModuleRecord,
  saveManualModuleRecord,
  subscribeToManualModuleRecords,
} from '../services/manualModuleService';
import { getNativeModuleContent } from '../services/nativeModuleData';
import { courierSeedRecords, machineSeedRecords } from '../services/operationsSeedData';
import { playError, playNotification, playSuccess } from '../services/soundManager';

const legacySeedIdPattern = /^(schedule|machine|change|discount|occurrence|map)-\d+$/;

function buildInitialFormState(config) {
  if (!config) {
    return {};
  }

  return config.fields.reduce((accumulator, field) => {
    const defaultValue = typeof field.defaultValue === 'function'
      ? field.defaultValue()
      : field.defaultValue;

    accumulator[field.name] = defaultValue
      ?? (field.type === 'select'
        ? field.options[0]
        : field.type === 'checkbox'
          ? false
          : '');
    return accumulator;
  }, {});
}

function sanitizeManualRecords(records) {
  return records.filter((record) => !legacySeedIdPattern.test(record.id ?? ''));
}

function buildRouteRecords(routePath, manager) {
  if (!manager) {
    return [];
  }

  if (routePath === 'machine-history') {
    return [];
  }

  if (manager.dailyResetHour != null) {
    return sanitizeManualRecords(
      loadResettableLocalRecords(manager.storageKey, manager.initialRecords, manager.dailyResetHour),
    );
  }

  return sanitizeManualRecords(loadLocalRecords(manager.storageKey, manager.initialRecords));
}

function buildAuditContext(session) {
  return {
    updatedAt: new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date()),
    updatedBy: session?.operatorName ?? session?.displayName ?? 'Operador local',
  };
}

function buildResolvedFields(config, routePath, dynamicOptions) {
  if (!config) {
    return [];
  }

  const courierOptions = dynamicOptions.courierOptions;
  const machineOptions = dynamicOptions.machineOptions;
  const storeMemberOptions = dynamicOptions.storeMemberOptions;
  const destinationOptions = courierOptions.length > 0 ? courierOptions : ['Cadastre um entregador primeiro'];
  const scheduleCourierOptions = courierOptions.length > 0 ? courierOptions : ['Cadastre um entregador primeiro'];

  return config.fields.map((field) => {
    if (routePath === 'change' && field.name === 'origin') {
      return {
        ...field,
        options: storeUserOptions,
      };
    }

    if (routePath === 'change' && field.name === 'destination') {
      return {
        ...field,
        options: destinationOptions,
      };
    }

    if (routePath === 'schedule' && field.name === 'courier') {
      return {
        ...field,
        options: scheduleCourierOptions,
      };
    }

    if (routePath === 'schedule' && field.name === 'machine') {
      return {
        ...field,
        options: machineOptions.length > 0
          ? ['Sem maquininha', ...machineOptions]
          : ['Sem maquininha'],
      };
    }

    if (routePath === 'delivery-reading' && field.name === 'courier') {
      return {
        ...field,
        options: courierOptions.length > 0 ? courierOptions : ['Cadastre um entregador primeiro'],
      };
    }

    if (routePath === 'machines' && field.name === 'holder') {
      return {
        ...field,
        options: courierOptions.length > 0
          ? ['Nenhum', ...courierOptions]
          : ['Nenhum', 'Cadastre um entregador primeiro'],
      };
    }

    if (routePath === 'occurrences' && field.name === 'owner') {
      return {
        ...field,
        options: storeMemberOptions.length > 0 ? storeMemberOptions : ['Operador local'],
      };
    }

    if (routePath === 'advances' && field.name === 'recipient') {
      return {
        ...field,
        options: storeMemberOptions.length > 0 ? storeMemberOptions : ['Operador local'],
      };
    }

    return field;
  });
}

function renderPanel(panel) {
  if (panel.items) {
    return (
      <div className="native-module__list">
        {panel.items.map((item) => (
          <div key={`${panel.title}-${item.label}`} className="native-module__list-item">
            <div>
              <p className="native-module__list-label">{item.label}</p>
              <strong className="native-module__list-value">{item.value}</strong>
            </div>
            <span className={`ui-badge ui-badge--${item.tone ?? 'info'}`}>{item.tone ?? 'info'}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="native-module__timeline">
      {panel.timeline.map((entry) => (
        <article key={`${panel.title}-${entry.title}`} className="native-module__timeline-item">
          <span className="native-module__timeline-dot" />
          <div>
            <p className="native-module__timeline-title">{entry.title}</p>
            <p className="native-module__timeline-meta">{entry.meta}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function formatChecklistDate() {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(new Date())
    .replace(/\./g, '')
    .toUpperCase();
}

function buildMachineChecklistRecords(machineRecords, checklist = []) {
  return machineRecords.map((machine) => {
    const savedState = checklist.find((item) => item.id === machine.id);

    return {
      id: machine.id,
      device: machine.device,
      holder: machine.holder,
      model: machine.model,
      status: savedState?.status ?? 'Ausente',
      machineStatus: machine.status ?? 'Ativa',
      updatedAt: savedState?.updatedAt ?? '',
      updatedBy: savedState?.updatedBy ?? '',
    };
  });
}

function shouldUseLocalFallback(error) {
  return Boolean(error);
}

function NativeModulePage({ route }) {
  const { session } = useAuth();
  const { currentStoreId, tenantId } = useStore();
  const content = getNativeModuleContent(route);
  const manager = getManualModuleConfig(route.path);
  const [availableCourierNames, setAvailableCourierNames] = useState(() => loadLocalRecords(MANUAL_COURIER_STORAGE_KEY, courierSeedRecords).map((courier) => courier?.name?.trim()).filter(Boolean));
  const [availableMachineOptions, setAvailableMachineOptions] = useState(() => loadLocalRecords('nexus-module-machines', machineSeedRecords).map((machine) => machine?.device?.trim()).filter(Boolean));
  const storeMemberOptions = useMemo(
    () => Array.from(new Set([...storeUserOptions, ...availableCourierNames])),
    [availableCourierNames],
  );
  const canSyncModuleRecords = Boolean(firebaseReady && currentStoreId);
  const resolvedFields = useMemo(
    () => buildResolvedFields(manager, route.path, {
      courierOptions: availableCourierNames,
      machineOptions: availableMachineOptions,
      storeMemberOptions,
    }),
    [availableCourierNames, availableMachineOptions, manager, route.path, storeMemberOptions],
  );
  const managerWithResolvedFields = useMemo(
    () => (manager ? { ...manager, fields: resolvedFields } : null),
    [manager, resolvedFields],
  );
  const [formValues, setFormValues] = useState(() => buildInitialFormState(managerWithResolvedFields));
  const [records, setRecords] = useState(() => (
    manager ? buildRouteRecords(route.path, manager) : []
  ));
  const [machineChecklistRecords, setMachineChecklistRecords] = useState(() => (
    route.path === 'machines' ? buildMachineChecklistRecords(buildRouteRecords('machines', manager), loadResettableLocalRecords('nexus-module-machine-history', [], 3)) : []
  ));
  const [machineChecklistState, setMachineChecklistState] = useState(() => loadResettableLocalRecords('nexus-module-machine-history', [], 3));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [errorMessage, setErrorMessage] = useState('');
  const [scheduleMachineDrafts, setScheduleMachineDrafts] = useState({});
  const [recentlyClosedRecordId, setRecentlyClosedRecordId] = useState(null);
  const scheduleImageRef = useRef(null);
  const machineChecklistImageRef = useRef(null);

  useEffect(() => subscribeToCouriers(
    currentStoreId,
    (couriers) => {
      const nextCourierNames = couriers
        .map((courier) => courier?.name?.trim())
        .filter(Boolean);

      setAvailableCourierNames(nextCourierNames);
    },
    undefined,
  ), [currentStoreId]);

  useEffect(() => subscribeToManualModuleRecords({
    storeId: currentStoreId,
    modulePath: 'machines',
    storageKey: 'nexus-module-machines',
    initialRecords: machineSeedRecords,
    onData: (machineRecords) => {
      const nextMachineOptions = Array.from(new Set(
        machineRecords
          .map((machine) => machine?.device?.trim())
          .filter(Boolean),
      ));

      setAvailableMachineOptions(nextMachineOptions);
    },
  }), [currentStoreId]);

  useEffect(() => subscribeToManualModuleRecords({
    storeId: currentStoreId,
    modulePath: 'machine-history',
    storageKey: 'nexus-module-machine-history',
    initialRecords: [],
    dailyResetHour: 3,
    onData: (checklistRecords) => {
      setMachineChecklistState(checklistRecords);
    },
  }), [currentStoreId]);

  useEffect(() => {
    if (!managerWithResolvedFields) {
      setFormValues({});
      setRecords([]);
      return;
    }

    setFormValues(buildInitialFormState(managerWithResolvedFields));
    setSearchTerm('');
    setStatusFilter('all');
    setErrorMessage('');
    setScheduleMachineDrafts({});
    setRecentlyClosedRecordId(null);
  }, [manager, managerWithResolvedFields, route.path]);

  useEffect(() => {
    if (!manager) {
      setRecords([]);
      return () => {};
    }

    return subscribeToManualModuleRecords({
      storeId: currentStoreId,
      modulePath: route.path,
      storageKey: manager.storageKey,
      initialRecords: manager.initialRecords,
      dailyResetHour: manager.dailyResetHour ?? null,
      onData: (nextRecords) => {
        setRecords(sanitizeManualRecords(nextRecords));
        setErrorMessage('');
      },
      onError: () => {
        setErrorMessage('Nao foi possivel sincronizar os registros deste modulo com a base compartilhada.');
      },
    });
  }, [currentStoreId, manager, route.path]);

  useEffect(() => {
    if (manager) {
      if (route.path === 'machines') {
        saveLocalRecords(manager.storageKey, records);
        return;
      }

      if (manager.dailyResetHour != null) {
        saveResettableLocalRecords(manager.storageKey, records, manager.dailyResetHour);
        return;
      }

      saveLocalRecords(manager.storageKey, records);
    }
  }, [manager, records, route.path]);

  useEffect(() => {
    if (route.path !== 'machines') {
      return;
    }

    setMachineChecklistRecords(buildMachineChecklistRecords(records, machineChecklistState));
  }, [machineChecklistState, records, route.path]);

  useEffect(() => {
    if (route.path !== 'machines') {
      return;
    }

    saveResettableLocalRecords('nexus-module-machine-history', machineChecklistRecords, 3);
  }, [machineChecklistRecords, route.path]);

  useEffect(() => {
    if (manager?.dailyResetHour == null) {
      return;
    }

    const refreshRecords = () => {
      setRecords(buildRouteRecords(route.path, manager));
    };

    window.addEventListener('focus', refreshRecords);
    return () => window.removeEventListener('focus', refreshRecords);
  }, [manager, route.path]);

  useEffect(() => {
    if (!recentlyClosedRecordId) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setRecentlyClosedRecordId(null);
    }, 1400);

    return () => window.clearTimeout(timeoutId);
  }, [recentlyClosedRecordId]);

  const metrics = useMemo(() => {
    if (route.path === 'machines') {
      const presentCount = machineChecklistRecords.filter((record) => record.status === 'Presente').length;
      const absentCount = machineChecklistRecords.filter((record) => record.status !== 'Presente').length;
      const problemCount = machineChecklistRecords.filter((record) => ['Manutencao', 'Carga'].includes(record.machineStatus)).length;

      return [
        {
          label: 'Total maquininhas',
          value: String(machineChecklistRecords.length).padStart(2, '0'),
          meta: 'base cadastrada para o turno',
          badgeText: 'parque',
          badgeClass: 'ui-badge--info',
        },
        {
          label: 'Presentes hoje',
          value: String(presentCount).padStart(2, '0'),
          meta: 'unidades confirmadas no checklist',
          badgeText: 'ok',
          badgeClass: 'ui-badge--success',
        },
        {
          label: 'Ausentes',
          value: String(absentCount).padStart(2, '0'),
          meta: 'ainda nao conferidas no dia',
          badgeText: 'fila',
          badgeClass: 'ui-badge--danger',
        },
        {
          label: 'Com problema',
          value: String(problemCount).padStart(2, '0'),
          meta: 'maquininhas em carga ou manutencao',
          badgeText: 'alerta',
          badgeClass: 'ui-badge--special',
        },
      ];
    }

    if (route.path === 'machine-history') {
      const historyEvents = loadAuditEvents().filter(
        (event) => event.modulePath === 'machines' && event.action.toLowerCase().includes('checklist'),
      );
      const uniqueDays = new Set(historyEvents.map((event) => event.timestamp.slice(0, 10)));
      const uniqueDevices = new Set(historyEvents.map((event) => event.target));

      return [
        {
          label: 'Dias com registro',
          value: String(uniqueDays.size).padStart(2, '0'),
          meta: 'datas com checklist registrado',
          badgeText: 'historico',
          badgeClass: 'ui-badge--info',
        },
        {
          label: 'Marcacoes',
          value: String(historyEvents.length).padStart(2, '0'),
          meta: 'eventos de presenca salvos',
          badgeText: 'log',
          badgeClass: 'ui-badge--success',
        },
        {
          label: 'Maquininhas tocadas',
          value: String(uniqueDevices.size).padStart(2, '0'),
          meta: 'unidades que apareceram no historico',
          badgeText: 'base',
          badgeClass: 'ui-badge--special',
        },
      ];
    }

    if (route.path === 'delivery-reading') {
      const closedCount = records.filter((record) => record.closed).length;
      const openCount = records.filter((record) => !record.closed).length;
      const turboCount = records.filter((record) => record.turbo).length;

      return [
        {
          label: 'Leituras do dia',
          value: String(records.length).padStart(2, '0'),
          meta: 'codigos lidos neste turno',
          badgeText: 'leitura',
          badgeClass: 'ui-badge--info',
        },
        {
          label: 'Fechadas',
          value: String(closedCount).padStart(2, '0'),
          meta: 'entregas ja fechadas na operacao',
          badgeText: 'ok',
          badgeClass: 'ui-badge--success',
        },
        {
          label: 'Em aberto',
          value: String(openCount).padStart(2, '0'),
          meta: 'leituras aguardando fechamento',
          badgeText: 'pendente',
          badgeClass: 'ui-badge--warning',
        },
        {
          label: 'Turbo',
          value: String(turboCount).padStart(2, '0'),
          meta: 'entregas marcadas como turbo',
          badgeText: 'turbo',
          badgeClass: 'ui-badge--special',
        },
      ];
    }

    if (!manager || content.metrics.length === 0) {
      return content.metrics;
    }

    return [
      {
        label: 'Registros do dia',
        value: String(records.length).padStart(2, '0'),
        meta: 'cadastros manuais ativos neste modulo',
        badgeText: 'manual',
        badgeClass: 'ui-badge--info',
      },
      {
        label: 'Atualizacao',
        value: records.length > 0 ? 'Ativa' : 'Aguardando',
        meta: records.length > 0
          ? canSyncModuleRecords
            ? 'base compartilhada pronta para consulta e exclusao'
            : 'base local pronta para consulta e exclusao'
          : 'adicione o primeiro registro para iniciar o modulo',
        badgeText: records.length > 0 ? 'online' : 'vazio',
        badgeClass: records.length > 0 ? 'ui-badge--success' : 'ui-badge--warning',
      },
      {
        label: 'Persistencia',
        value: canSyncModuleRecords ? 'Compartilhada' : 'Local',
        meta: canSyncModuleRecords
          ? 'registros sincronizados entre dispositivos da loja'
          : 'registros salvos neste dispositivo',
        badgeText: canSyncModuleRecords ? 'sync' : 'storage',
        badgeClass: canSyncModuleRecords ? 'ui-badge--success' : 'ui-badge--special',
      },
    ];
  }, [canSyncModuleRecords, content.metrics, machineChecklistRecords, manager, records.length, route.path]);

  const statusField = managerWithResolvedFields?.fields.find((field) => field.name === 'status');
  const scheduleMachineField = managerWithResolvedFields?.fields.find((field) => field.name === 'machine');
  const scheduleMachineOptions = scheduleMachineField?.options ?? ['Sem maquininha'];
  const visibleRecords = useMemo(() => {
    if (!manager) {
      return [];
    }

    return records.filter((record) => {
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
      const matchesSearch = searchTerm.trim().length === 0
        || manager.toRow(record).join(' ').toLowerCase().includes(searchTerm.trim().toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [manager, records, searchTerm, statusFilter]);

  const tableColumns = manager ? [...manager.columns, 'Acoes'] : content.table.columns;
  const tableRows = manager ? visibleRecords.map((record) => manager.toRow(record)) : content.table.rows;
  const visibleMachineChecklistRecords = useMemo(() => {
    if (route.path !== 'machines') {
      return [];
    }

    return machineChecklistRecords.filter((record) => {
      const rawText = [record.device, record.holder, record.model, record.status, record.machineStatus].join(' ').toLowerCase();
      return searchTerm.trim().length === 0 || rawText.includes(searchTerm.trim().toLowerCase());
    });
  }, [machineChecklistRecords, route.path, searchTerm]);
  const visibleOpenDeliveryRecords = useMemo(
    () => (route.path === 'delivery-reading'
      ? visibleRecords.filter((record) => !record.closed)
      : []),
    [route.path, visibleRecords],
  );
  const visibleClosedDeliveryRecords = useMemo(
    () => (route.path === 'delivery-reading'
      ? visibleRecords.filter((record) => record.closed)
      : []),
    [route.path, visibleRecords],
  );

  function updateField(name, value) {
    setFormValues((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetManagedForm() {
    setFormValues(buildInitialFormState(managerWithResolvedFields));
  }

  async function saveRecordWithFallback({
    modulePath,
    storageKey,
    dailyResetHour = null,
    record,
    onLocalApply,
  }) {
    if (!canSyncModuleRecords) {
      onLocalApply();
      return 'local';
    }

    try {
      await saveManualModuleRecord({
        storeId: currentStoreId,
        tenantId,
        modulePath,
        storageKey,
        dailyResetHour,
        record,
      });
      return 'remote';
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      onLocalApply();
      return 'local';
    }
  }

  async function deleteRecordWithFallback({
    modulePath,
    recordId,
    onLocalApply,
  }) {
    if (!canSyncModuleRecords) {
      onLocalApply();
      return 'local';
    }

    try {
      await deleteManualModuleRecord({
        storeId: currentStoreId,
        modulePath,
        recordId,
      });
      return 'remote';
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      onLocalApply();
      return 'local';
    }
  }

  async function clearRecordsWithFallback({
    modulePath,
    storageKey,
    initialRecords = [],
    dailyResetHour = null,
    onLocalApply,
  }) {
    if (!canSyncModuleRecords) {
      onLocalApply();
      return 'local';
    }

    try {
      await clearManualModuleRecords({
        storeId: currentStoreId,
        modulePath,
        storageKey,
        initialRecords,
        dailyResetHour,
      });
      return 'remote';
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      onLocalApply();
      return 'local';
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!managerWithResolvedFields) {
      playError();
      return;
    }

    const newRecord = {
      ...manager.createRecord(formValues, buildAuditContext(session)),
      createdAtClient: new Date().toISOString(),
    };

    try {
      await saveRecordWithFallback({
        modulePath: route.path,
        storageKey: manager.storageKey,
        dailyResetHour: manager.dailyResetHour ?? null,
        record: newRecord,
        onLocalApply: () => {
          setRecords((current) => [newRecord, ...current]);
        },
      });

      setFormValues(buildInitialFormState(managerWithResolvedFields));
      setErrorMessage('');
      playSuccess();
      appendAuditEvent({
        module: route.title,
        modulePath: route.path,
        actor: session?.operatorName ?? session?.displayName ?? 'Operador local',
        action: 'Criou registro',
        target: newRecord.deliveryCode ?? newRecord.code ?? newRecord.courier ?? newRecord.device ?? newRecord.zone ?? newRecord.order ?? newRecord.origin ?? 'registro manual',
        details: `Cadastro criado em ${route.title}`,
      });
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel salvar o registro.');
      playError();
    }
  }

  async function handleDelete(recordId) {
    const record = records.find((item) => item.id === recordId);

    try {
      await deleteRecordWithFallback({
        modulePath: route.path,
        recordId,
        onLocalApply: () => {
          setRecords((current) => current.filter((item) => item.id !== recordId));
        },
      });

      setErrorMessage('');
      playSuccess();

      appendAuditEvent({
        module: route.title,
        modulePath: route.path,
        actor: session?.operatorName ?? session?.displayName ?? 'Operador local',
        action: 'Excluiu registro',
        target: record?.deliveryCode ?? record?.code ?? record?.courier ?? record?.device ?? record?.zone ?? record?.order ?? record?.origin ?? 'registro manual',
        details: `Registro removido de ${route.title}`,
      });
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel excluir o registro.');
      playError();
    }
  }

  function handleScheduleMachineDraftChange(recordId, value) {
    setScheduleMachineDrafts((current) => ({
      ...current,
      [recordId]: value,
    }));
  }

  async function handleScheduleMachineUpdate(recordId) {
    if (route.path !== 'schedule') {
      return;
    }

    const record = records.find((item) => item.id === recordId);

    if (!record) {
      playError();
      return;
    }

    const nextMachine = (scheduleMachineDrafts[recordId] ?? record.machine ?? 'Sem maquininha').trim() || 'Sem maquininha';
    const auditContext = buildAuditContext(session);

    if (nextMachine === record.machine) {
      return;
    }

    const nextRecord = {
      ...record,
      machine: nextMachine,
      updatedAt: auditContext.updatedAt,
      updatedBy: auditContext.updatedBy,
    };

    try {
      await saveRecordWithFallback({
        modulePath: route.path,
        storageKey: manager.storageKey,
        dailyResetHour: manager.dailyResetHour ?? null,
        record: nextRecord,
        onLocalApply: () => {
          setRecords((current) => current.map((item) => (
            item.id === recordId ? nextRecord : item
          )));
        },
      });

      setScheduleMachineDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[recordId];
        return nextDrafts;
      });
      setErrorMessage('');
      playSuccess();
      appendAuditEvent({
        module: route.title,
        modulePath: route.path,
        actor: auditContext.updatedBy,
        action: 'Alterou maquininha da escala',
        target: record.courier ?? 'entregador',
        details: `Maquininha atualizada para ${nextMachine}`,
      });
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel atualizar a maquininha da escala.');
      playError();
    }
  }

  async function handleClearAll() {
    if (!window.confirm('Deseja remover todos os registros deste modulo?')) {
      return;
    }

    try {
      await clearRecordsWithFallback({
        modulePath: route.path,
        storageKey: manager?.storageKey,
        initialRecords: manager?.initialRecords ?? [],
        dailyResetHour: manager?.dailyResetHour ?? null,
        onLocalApply: () => {
          setRecords([]);
        },
      });

      setErrorMessage('');
      playNotification();
      appendAuditEvent({
        module: route.title,
        modulePath: route.path,
        actor: session?.operatorName ?? session?.displayName ?? 'Operador local',
        action: 'Limpou modulo',
        target: route.title,
        details: 'Todos os registros locais foram removidos',
      });
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel limpar os registros do modulo.');
      playError();
    }
  }

  async function handleManualReset() {
    if (!manager?.manualResetLabel) {
      return;
    }

    const confirmed = window.confirm('Deseja resetar os registros deste modulo agora?');

    if (!confirmed) {
      return;
    }

    try {
      const nextRecords = route.path === 'machine-history'
        ? buildRouteRecords(route.path, manager)
        : resetLocalRecordsNow(manager.storageKey, [], manager.dailyResetHour ?? 3);
      await clearRecordsWithFallback({
        modulePath: route.path,
        storageKey: manager.storageKey,
        initialRecords: [],
        dailyResetHour: manager.dailyResetHour ?? 3,
        onLocalApply: () => {
          setRecords(nextRecords);
        },
      });

      setErrorMessage('');
      playNotification();
      appendAuditEvent({
        module: route.title,
        modulePath: route.path,
        actor: session?.operatorName ?? session?.displayName ?? 'Operador local',
        action: 'Reset manual',
        target: route.title,
        details: 'Modulo resetado manualmente pela operacao',
      });
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel resetar o modulo.');
      playError();
    }
  }

  async function exportImageFromRef(targetRef, filePrefix, failureMessage) {
    if (!targetRef?.current) {
      playError();
      return;
    }

    try {
      setErrorMessage('');
      const dataUrl = await toPng(targetRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#08111f',
      });

      const link = document.createElement('a');
      const today = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date()).replace(/\//g, '-');

      link.href = dataUrl;
      link.download = `${filePrefix}-${today}.png`;
      link.click();
      playNotification();
    } catch (error) {
      playError();
      setErrorMessage(failureMessage);
    }
  }

  async function handleExportScheduleImage() {
    if (route.path !== 'schedule') {
      playError();
      return;
    }

    await exportImageFromRef(scheduleImageRef, 'escala', 'Nao foi possivel exportar a escala como imagem.');
  }

  async function handleExportMachineChecklistImage() {
    if (route.path !== 'machines') {
      playError();
      return;
    }

    await exportImageFromRef(
      machineChecklistImageRef,
      'checklist-maquininhas',
      'Nao foi possivel exportar a checklist de maquininhas como imagem.',
    );
  }

  function handleMarkReturned(recordId) {
    if (!manager?.markReturned) {
      return;
    }

    const { updatedAt: returnedAt, updatedBy: returnedBy } = buildAuditContext(session);

    setRecords((current) => current.map((record) => (
      record.id === recordId
        ? manager.markReturned(record, { returnedAt, returnedBy })
        : record
    )));
    playSuccess();
    const record = records.find((item) => item.id === recordId);
    appendAuditEvent({
      module: route.title,
      modulePath: route.path,
      actor: returnedBy,
      action: 'Confirmou retorno',
      target: record?.origin ?? 'troco',
      details: `Retorno confirmado em ${route.title}`,
    });
  }

  async function handleApplyAction(recordId) {
    if (!manager?.applyAction) {
      return;
    }

    const auditContext = buildAuditContext(session);
    const targetRecord = records.find((item) => item.id === recordId);
    const nextRecord = targetRecord ? manager.applyAction(targetRecord, auditContext) : null;

    if (!nextRecord) {
      return;
    }

    try {
      await saveRecordWithFallback({
        modulePath: route.path,
        storageKey: manager.storageKey,
        dailyResetHour: manager.dailyResetHour ?? null,
        record: nextRecord,
        onLocalApply: () => {
          setRecords((current) => current.map((record) => (
            record.id === recordId ? nextRecord : record
          )));
        },
      });

      if (route.path === 'delivery-reading' && !targetRecord.closed) {
        setRecentlyClosedRecordId(recordId);
      }
      setErrorMessage('');
      playSuccess();
      appendAuditEvent({
        module: route.title,
        modulePath: route.path,
        actor: auditContext.updatedBy,
        action: manager.actionLabel ?? 'Atualizou registro',
        target: targetRecord.deliveryCode ?? targetRecord.code ?? targetRecord.device ?? targetRecord.order ?? targetRecord.origin ?? targetRecord.zone ?? 'registro manual',
        details: `Acao aplicada em ${route.title}`,
      });
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel atualizar o registro.');
      playError();
    }
  }

  async function handleMachineChecklistToggle(recordId) {
    const auditContext = buildAuditContext(session);
    const record = machineChecklistRecords.find((item) => item.id === recordId);

    if (!record) {
      return;
    }

    const nextStatus = record.status === 'Presente' ? 'Ausente' : 'Presente';
    const nextRecord = {
      ...record,
      status: nextStatus,
      updatedAt: auditContext.updatedAt,
      updatedBy: auditContext.updatedBy,
    };

    try {
      await saveRecordWithFallback({
        modulePath: 'machine-history',
        storageKey: 'nexus-module-machine-history',
        dailyResetHour: 3,
        record: nextRecord,
        onLocalApply: () => {
          setMachineChecklistRecords((current) => current.map((item) => (
            item.id === recordId ? nextRecord : item
          )));
        },
      });

      setErrorMessage('');
      playSuccess();

      appendAuditEvent({
        module: 'Maquininhas',
        modulePath: 'machines',
        actor: auditContext.updatedBy,
        action: nextStatus === 'Presente' ? 'Marcou presente no checklist' : 'Desmarcou presenca no checklist',
        target: record?.device ?? 'maquininha',
        details: `Checklist atualizado para ${record?.device ?? 'maquininha'}`,
      });
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel atualizar o checklist da maquininha.');
      playError();
    }
  }

  const machineHistoryEvents = useMemo(() => {
    if (route.path !== 'machine-history') {
      return [];
    }

    return loadAuditEvents()
      .filter((event) => event.modulePath === 'machines' && event.action.toLowerCase().includes('checklist'))
      .map((event) => {
        const eventDate = new Date(event.timestamp);
        return {
          id: event.id,
          dayKey: event.timestamp.slice(0, 10),
          dayLabel: new Intl.DateTimeFormat('pt-BR', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }).format(eventDate).replace(/\./g, '').toUpperCase(),
          device: event.target,
          actor: event.actor,
          action: event.action,
          time: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(eventDate),
        };
      });
  }, [route.path, records.length]);

  const machineHistoryGroups = useMemo(() => {
    if (route.path !== 'machine-history') {
      return [];
    }

    const grouped = machineHistoryEvents.reduce((accumulator, event) => {
      const currentGroup = accumulator.get(event.dayKey) ?? {
        dayKey: event.dayKey,
        dayLabel: event.dayLabel,
        entries: [],
      };

      currentGroup.entries.push(event);
      accumulator.set(event.dayKey, currentGroup);
      return accumulator;
    }, new Map());

    return Array.from(grouped.values());
  }, [machineHistoryEvents, route.path]);

  const isSchedule = route.path === 'schedule';
  const isDeliveryReading = route.path === 'delivery-reading';
  const isMachineChecklist = route.path === 'machines';
  const isMachineHistory = route.path === 'machine-history';

  return (
    <div className={`page-stack native-module-page native-module-page--${route.path}`}>
      <PageIntro eyebrow={route.eyebrow} title={route.title} description={route.description} />

      <div className="card-grid">
        {metrics.map((metric) => (
          <MetricCard
            key={`${route.path}-${metric.label}`}
            label={metric.label}
            value={metric.value}
            meta={metric.meta}
            badgeText={metric.badgeText}
            badgeClass={metric.badgeClass}
          />
        ))}
      </div>

      {managerWithResolvedFields && !managerWithResolvedFields.hideForm ? (
        <SurfaceCard title={manager.formTitle}>
          <div className="native-module__form-shell">
            <div className="native-module__form-copy">
              <p className="text-body">{manager.formDescription}</p>
              <span className="ui-badge ui-badge--info">{records.length} registros do dia</span>
            </div>

            <form
              className={`native-module__form-grid${route.path === 'advances' ? ' native-module__form-grid--advances' : ''}`}
              onSubmit={handleSubmit}
            >
              {managerWithResolvedFields.fields.map((field) => (
                <div key={`${route.path}-${field.name}`} className="ui-field">
                  {field.type === 'checkbox' ? (
                    <label className="native-module__checkbox" htmlFor={`${route.path}-${field.name}`}>
                      <input
                        id={`${route.path}-${field.name}`}
                        className="native-module__checkbox-input"
                        type="checkbox"
                        checked={Boolean(formValues[field.name])}
                        onChange={(event) => updateField(field.name, event.target.checked)}
                      />
                      <span className="native-module__checkbox-box" aria-hidden="true" />
                      <span className="native-module__checkbox-copy">
                        <strong>{field.label}</strong>
                        <small>{field.description ?? 'Marque esta opcao quando ela se aplicar ao registro.'}</small>
                      </span>
                    </label>
                  ) : (
                    <>
                      <label className="ui-label" htmlFor={`${route.path}-${field.name}`}>
                        {field.label}
                      </label>

                      {field.type === 'select' ? (
                    <select
                      id={`${route.path}-${field.name}`}
                      className="ui-select"
                      value={formValues[field.name] ?? ''}
                      required={field.required !== false}
                      onChange={(event) => updateField(field.name, event.target.value)}
                    >
                      {field.options.map((option) => (
                        <option key={`${route.path}-${field.name}-${option}`} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      id={`${route.path}-${field.name}`}
                      className="ui-textarea"
                      value={formValues[field.name] ?? ''}
                      placeholder={field.placeholder}
                      rows={4}
                      required={field.required !== false}
                      onChange={(event) => updateField(field.name, event.target.value)}
                    />
                  ) : (
                    <input
                      id={`${route.path}-${field.name}`}
                      className="ui-input"
                      type={field.type ?? 'text'}
                      value={formValues[field.name] ?? ''}
                      placeholder={field.placeholder}
                      required={field.required !== false}
                      onChange={(event) => updateField(field.name, event.target.value)}
                    />
                      )}
                    </>
                  )}
                </div>
              ))}

              <div className="native-module__form-actions">
                {route.path === 'advances' ? (
                  <button type="button" className="ui-button ui-button--ghost" onClick={resetManagedForm}>
                    Cancelar
                  </button>
                ) : null}
                <button type="submit" className="ui-button ui-button--secondary">
                  {manager.submitLabel}
                </button>
              </div>
            </form>
          </div>
        </SurfaceCard>
      ) : null}

      {!manager ? (
        <div className="native-module__panels">
          {content.panels.map((panel) => (
            <SurfaceCard key={`${route.path}-${panel.title}`} title={panel.title}>
              {renderPanel(panel)}
            </SurfaceCard>
          ))}
        </div>
      ) : null}

      <div>
        <SurfaceCard title={content.table.title}>
        {manager && !manager.hideToolbar ? (
          <div className="native-module__toolbar">
            <div className="ui-field">
              <label className="ui-label" htmlFor={`${route.path}-search`}>
                Buscar
              </label>
              <input
                id={`${route.path}-search`}
                className="ui-input"
                type="text"
                value={searchTerm}
                placeholder="Buscar nos registros"
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            {statusField ? (
              <div className="ui-field">
                <label className="ui-label" htmlFor={`${route.path}-status-filter`}>
                  Filtrar status
                </label>
                <select
                  id={`${route.path}-status-filter`}
                  className="ui-select"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">Todos</option>
                  {statusField.options.map((option) => (
                    <option key={`${route.path}-status-${option}`} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="native-module__toolbar-actions">
              <span className="ui-badge ui-badge--special">{tableRows.length} visiveis</span>
              {route.path === 'schedule' ? (
                <button type="button" className="ui-button ui-button--secondary" onClick={handleExportScheduleImage}>
                  Exportar imagem
                </button>
              ) : null}
              {route.path === 'machines' ? (
                <button type="button" className="ui-button ui-button--secondary" onClick={handleExportMachineChecklistImage}>
                  Exportar imagem
                </button>
              ) : null}
              {manager?.manualResetLabel ? (
                <button type="button" className="ui-button ui-button--ghost" onClick={handleManualReset}>
                  {manager.manualResetLabel}
                </button>
              ) : null}
              {records.length > 0 && manager?.allowClearAll !== false ? (
                <button type="button" className="ui-button ui-button--ghost" onClick={handleClearAll}>
                  Limpar tudo
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

        {isMachineHistory ? (
          <div className="machine-history">
            <div className="machine-history__layout">
              <aside className="machine-history__calendar">
                <p className="machine-history__calendar-title">{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date())}</p>
                <div className="machine-history__calendar-grid">
                  {Array.from({ length: 31 }, (_, index) => {
                    const day = String(index + 1).padStart(2, '0');
                    const month = String(new Date().getMonth() + 1).padStart(2, '0');
                    const year = String(new Date().getFullYear());
                    const dayKey = `${year}-${month}-${day}`;
                    const hasEntry = machineHistoryGroups.some((group) => group.dayKey === dayKey);

                    return (
                      <span
                        key={dayKey}
                        className={`machine-history__day ${hasEntry ? 'machine-history__day--active' : ''}`}
                      >
                        {index + 1}
                      </span>
                    );
                  })}
                </div>
                <span className="machine-history__legend">Com registros</span>
              </aside>

              <div className="machine-history__content">
                {machineHistoryGroups.length === 0 ? (
                  <div className="native-module__empty-state">
                    <p className="text-section-title">Nenhum historico encontrado</p>
                    <p className="text-body">As marcacoes do checklist das maquininhas vao aparecer aqui por dia.</p>
                  </div>
                ) : (
                  machineHistoryGroups.map((group) => (
                    <section key={group.dayKey} className="machine-history__day-group">
                      <header className="machine-history__day-header">
                        <strong>{group.dayLabel}</strong>
                        <span>{group.entries.length} registros</span>
                      </header>
                      <div className="machine-history__entries">
                        {group.entries.map((entry) => (
                          <article key={entry.id} className="machine-history__entry">
                            <strong className="machine-history__entry-device">{entry.device}</strong>
                            <div>
                              <p className="machine-history__entry-actor">{entry.actor}</p>
                              <p className="machine-history__entry-action">{entry.action}</p>
                            </div>
                            <span className="machine-history__entry-time">{entry.time}</span>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : tableRows.length === 0 && manager ? (
          <div className="native-module__empty-state">
            <p className="text-section-title">{records.length === 0 ? manager.emptyTitle : 'Nenhum resultado encontrado'}</p>
            <p className="text-body">
              {records.length === 0
                ? manager.emptyDescription
                : 'Ajuste a busca ou o filtro para localizar registros deste modulo.'}
            </p>
          </div>
        ) : isDeliveryReading ? (
          <div className="delivery-reading">
            <div className="delivery-reading__sections">
              <section className="delivery-reading__section delivery-reading__section--open">
                <header className="delivery-reading__section-header">
                  <div>
                    <p className="delivery-reading__section-eyebrow">Fila lida</p>
                    <h3 className="delivery-reading__section-title">Entregas lidas</h3>
                  </div>
                  <span className="ui-badge ui-badge--warning">{visibleOpenDeliveryRecords.length}</span>
                </header>

                {visibleOpenDeliveryRecords.length === 0 ? (
                  <div className="delivery-reading__empty">
                    <p className="text-label">Nenhuma entrega lida em aberto</p>
                    <p className="text-body">As entregas lidas e ainda nao fechadas vao aparecer primeiro aqui.</p>
                  </div>
                ) : (
                  <div className="delivery-reading__grid">
                    {visibleOpenDeliveryRecords.map((record) => (
                      <article
                        key={record.id}
                        className={`delivery-reading__card delivery-reading__card--open ${recentlyClosedRecordId === record.id ? 'delivery-reading__card--closing' : ''}`}
                      >
                        <div className="delivery-reading__top">
                          <div>
                            <p className="delivery-reading__eyebrow">Entrega lida</p>
                            <strong className="delivery-reading__code">{record.deliveryCode}</strong>
                          </div>
                          <div className="delivery-reading__badge-stack">
                            {record.turbo ? (
                              <span className="delivery-reading__turbo-badge">Turbo</span>
                            ) : null}
                            <span className="ui-badge ui-badge--warning">{record.status}</span>
                          </div>
                        </div>

                        <div className="delivery-reading__meta">
                          <div className="delivery-reading__meta-item">
                            <span>Entregador</span>
                            <strong>{record.courier}</strong>
                          </div>
                          <div className="delivery-reading__meta-item">
                            <span>Leitura</span>
                            <strong>{record.updatedAt && record.updatedBy ? `${record.updatedBy} - ${record.updatedAt}` : 'Sem atualizacao'}</strong>
                          </div>
                        </div>

                        <div className="delivery-reading__actions">
                          <button
                            type="button"
                            className="delivery-reading__close-button"
                            onClick={() => handleApplyAction(record.id)}
                          >
                            <span className="delivery-reading__close-icon" aria-hidden="true" />
                            <span>Fechar entrega</span>
                          </button>

                          <button
                            type="button"
                            className="ui-button ui-button--danger"
                            onClick={() => handleDelete(record.id)}
                          >
                            Excluir
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="delivery-reading__section delivery-reading__section--closed">
                <header className="delivery-reading__section-header">
                  <div>
                    <p className="delivery-reading__section-eyebrow">Fechamento</p>
                    <h3 className="delivery-reading__section-title">Entregas fechadas</h3>
                  </div>
                  <span className="ui-badge ui-badge--success">{visibleClosedDeliveryRecords.length}</span>
                </header>

                {visibleClosedDeliveryRecords.length === 0 ? (
                  <div className="delivery-reading__empty">
                    <p className="text-label">Nenhuma entrega fechada ainda</p>
                    <p className="text-body">Quando a leitura for confirmada como fechada, ela migra para esta area.</p>
                  </div>
                ) : (
                  <div className="delivery-reading__grid">
                    {visibleClosedDeliveryRecords.map((record) => (
                      <article
                        key={record.id}
                        className={`delivery-reading__card delivery-reading__card--closed ${recentlyClosedRecordId === record.id ? 'delivery-reading__card--closed-fresh' : ''}`}
                      >
                        <div className="delivery-reading__top">
                          <div>
                            <p className="delivery-reading__eyebrow">Entrega fechada</p>
                            <strong className="delivery-reading__code">{record.deliveryCode}</strong>
                          </div>
                          <div className="delivery-reading__badge-stack">
                            {record.turbo ? (
                              <span className="delivery-reading__turbo-badge">Turbo</span>
                            ) : null}
                            <span className="ui-badge ui-badge--success">{record.status}</span>
                          </div>
                        </div>

                        <div className="delivery-reading__meta">
                          <div className="delivery-reading__meta-item">
                            <span>Entregador</span>
                            <strong>{record.courier}</strong>
                          </div>
                          <div className="delivery-reading__meta-item">
                            <span>Fechamento</span>
                            <strong>{record.updatedAt && record.updatedBy ? `${record.updatedBy} - ${record.updatedAt}` : 'Sem atualizacao'}</strong>
                          </div>
                        </div>

                        <div className="delivery-reading__actions">
                          <label className="delivery-reading__check is-checked">
                            <input type="checkbox" checked readOnly />
                            <span className="delivery-reading__check-box" aria-hidden="true" />
                            <span>Fechada no fluxo</span>
                          </label>

                          <button
                            type="button"
                            className="ui-button ui-button--danger"
                            onClick={() => handleDelete(record.id)}
                          >
                            Excluir
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : isSchedule ? (
          <div className="schedule-records">
            <div className="schedule-records__grid">
              {visibleRecords.map((record) => (
                <article key={record.id} className="schedule-records__card">
                  <div className="schedule-records__top">
                    <div>
                      <p className="schedule-records__eyebrow">Entregador</p>
                      <strong className="schedule-records__name">{record.courier}</strong>
                    </div>
                    <span className="ui-badge ui-badge--info">{record.status}</span>
                  </div>

                  <div className="schedule-records__meta">
                    <div className="schedule-records__meta-item">
                      <span>Janela</span>
                      <strong>{record.window}</strong>
                    </div>
                    <div className="schedule-records__meta-item">
                      <span>Atualizacao</span>
                      <strong>{record.updatedAt && record.updatedBy ? `${record.updatedBy} - ${record.updatedAt}` : 'Sem atualizacao'}</strong>
                    </div>
                  </div>

                  <div className="schedule-records__editor">
                    <div className="ui-field">
                      <label className="ui-label" htmlFor={`schedule-machine-${record.id}`}>Maquininha</label>
                      <select
                        id={`schedule-machine-${record.id}`}
                        className="ui-select"
                        value={scheduleMachineDrafts[record.id] ?? record.machine ?? 'Sem maquininha'}
                        onChange={(event) => handleScheduleMachineDraftChange(record.id, event.target.value)}
                      >
                        {scheduleMachineOptions.map((option) => (
                          <option key={`${record.id}-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="schedule-records__actions">
                      <button
                        type="button"
                        className="ui-button ui-button--secondary"
                        onClick={() => handleScheduleMachineUpdate(record.id)}
                        disabled={(scheduleMachineDrafts[record.id] ?? record.machine ?? 'Sem maquininha') === (record.machine ?? 'Sem maquininha')}
                      >
                        Salvar maquininha
                      </button>
                      <button
                        type="button"
                        className="ui-button ui-button--danger"
                        onClick={() => handleDelete(record.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : isMachineChecklist ? (
          <div className="machine-checklist">
            <div className="machine-checklist__header">
              <span className="machine-checklist__eyebrow">Checklist - {formatChecklistDate()}</span>
            </div>

            <div className="machine-checklist__grid">
              {visibleMachineChecklistRecords.map((record) => {
                const isPresent = record.status === 'Presente';
                const hasProblem = ['Manutencao', 'Carga'].includes(record.machineStatus);

                return (
                  <article
                    key={record.id}
                    className={`machine-checklist__card ${isPresent ? 'machine-checklist__card--present' : 'machine-checklist__card--absent'}`}
                  >
                    <div className="machine-checklist__card-top">
                      <div className="machine-checklist__identity">
                        <strong className="machine-checklist__device">{record.device}</strong>
                        <div>
                          <p className="machine-checklist__model">{record.model}</p>
                          <p className="machine-checklist__holder">{record.holder || 'Nenhum'}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={`machine-checklist__toggle ${isPresent ? 'is-on' : ''}`}
                        onClick={() => handleMachineChecklistToggle(record.id)}
                        aria-pressed={isPresent}
                        aria-label={isPresent ? 'Presente ate o reset do dia' : 'Marcar presente'}
                        disabled={isPresent}
                      >
                        <span className="machine-checklist__toggle-thumb" />
                      </button>
                    </div>

                    <div className="machine-checklist__badges">
                      <span className={`ui-badge ${isPresent ? 'ui-badge--success' : 'ui-badge--warning'}`}>
                        {isPresent ? 'Presente' : 'Ausente'}
                      </span>
                      <span className={`ui-badge ${hasProblem ? 'ui-badge--danger' : 'ui-badge--info'}`}>
                        {record.machineStatus}
                      </span>
                    </div>

                      <div className="machine-checklist__footer">
                        <span className="machine-checklist__updated">
                          {record.updatedAt && record.updatedBy ? `${record.updatedBy} - ${record.updatedAt}` : 'Sem conferencia hoje'}
                        </span>
                        <label className={`machine-checklist__presence-check ${isPresent ? 'is-checked' : ''}`} htmlFor={`machine-check-${record.id}`}>
                          <input
                            id={`machine-check-${record.id}`}
                            type="checkbox"
                            checked={isPresent}
                            onChange={() => handleMachineChecklistToggle(record.id)}
                          />
                          <span className="machine-checklist__presence-box" aria-hidden="true" />
                          <span>{isPresent ? 'Presente no dia' : 'Confirmar presenca hoje'}</span>
                        </label>
                      </div>
                    </article>
                  );
                })}
            </div>
          </div>
        ) : (
          <div className="native-module__table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  {tableColumns.map((column) => (
                    <th key={`${route.path}-${column}`}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {manager
                  ? visibleRecords.map((record) => {
                    const row = manager.toRow(record);

                    return (
                      <tr key={record.id}>
                        {row.map((cell, index) => (
                          <td
                            key={`${record.id}-${index}`}
                            className={index === 0 ? 'ui-table__cell--strong' : undefined}
                          >
                            {cell}
                          </td>
                        ))}
                        <td className={`native-module__actions-cell${route.path === 'schedule' ? ' native-module__actions-cell--schedule' : ''}`}>
                          {route.path === 'schedule' ? (
                            <div className="native-module__inline-editor">
                              <select
                                className="ui-select native-module__inline-select"
                                value={scheduleMachineDrafts[record.id] ?? record.machine ?? 'Sem maquininha'}
                                onChange={(event) => handleScheduleMachineDraftChange(record.id, event.target.value)}
                              >
                                {scheduleMachineOptions.map((option) => (
                                  <option key={`${record.id}-${option}`} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="ui-button ui-button--secondary native-module__table-action"
                                onClick={() => handleScheduleMachineUpdate(record.id)}
                                disabled={(scheduleMachineDrafts[record.id] ?? record.machine ?? 'Sem maquininha') === (record.machine ?? 'Sem maquininha')}
                              >
                                Salvar
                              </button>
                            </div>
                          ) : null}
                          {manager.actionLabel ? (
                            <button
                              type="button"
                              className="ui-button ui-button--secondary native-module__table-action"
                              onClick={() => handleApplyAction(record.id)}
                            >
                              {manager.getActionLabel?.(record) ?? manager.actionLabel}
                            </button>
                          ) : null}
                          {manager.returnActionLabel && record.status !== 'Retornou' ? (
                            <button
                              type="button"
                              className="ui-button ui-button--success native-module__table-action"
                              onClick={() => handleMarkReturned(record.id)}
                            >
                              {manager.returnActionLabel}
                            </button>
                          ) : null}
                          {manager.allowDelete !== false ? (
                            <button
                              type="button"
                              className="ui-button ui-button--danger native-module__table-action"
                              onClick={() => handleDelete(record.id)}
                            >
                              Excluir
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                  : tableRows.map((row) => (
                    <tr key={`${route.path}-${row.join('-')}`}>
                      {row.map((cell, index) => (
                        <td
                          key={`${route.path}-${row[0]}-${index}`}
                          className={index === 0 ? 'ui-table__cell--strong' : undefined}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        </SurfaceCard>
      </div>

      {route.path === 'schedule' ? (
        <div className="schedule-export-image" aria-hidden="true">
          <div ref={scheduleImageRef} className="schedule-export-image__canvas">
            <header className="schedule-export-image__header">
              <div>
                <span className="schedule-export-image__eyebrow">Nexus-10 Operations</span>
                <h2 className="schedule-export-image__title">Escala do dia</h2>
                <p className="schedule-export-image__meta">{formatChecklistDate()}</p>
              </div>
              <div className="schedule-export-image__stamp">
                <span>Turno ativo</span>
                <strong>{visibleRecords.length} entregadores</strong>
              </div>
            </header>

            <div className="schedule-export-image__metrics">
              {metrics.slice(0, 3).map((metric) => (
                <article key={metric.label} className="schedule-export-image__metric">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small>{metric.meta}</small>
                </article>
              ))}
            </div>

            <div className="schedule-export-image__grid">
              {visibleRecords.map((record) => (
                <article key={record.id} className="schedule-export-image__card">
                  <div className="schedule-export-image__card-top">
                    <strong>{record.courier}</strong>
                    <span>{record.status}</span>
                  </div>
                  <div className="schedule-export-image__card-body">
                    <p>
                      <span>Janela</span>
                      <strong>{record.window}</strong>
                    </p>
                    <p>
                      <span>Maquininha</span>
                      <strong>{record.machine}</strong>
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <footer className="schedule-export-image__footer">
              <span>Gerado automaticamente pelo shell operacional</span>
              <strong>{session?.operatorName ?? session?.displayName ?? 'Operador local'}</strong>
            </footer>
          </div>
        </div>
      ) : null}

      {route.path === 'machines' ? (
        <div className="schedule-export-image" aria-hidden="true">
          <div ref={machineChecklistImageRef} className="schedule-export-image__canvas schedule-export-image__canvas--machines">
            <header className="schedule-export-image__header">
              <div>
                <span className="schedule-export-image__eyebrow">Nexus-10 Hardware</span>
                <h2 className="schedule-export-image__title">Checklist de maquininhas</h2>
                <p className="schedule-export-image__meta">{formatChecklistDate()}</p>
              </div>
              <div className="schedule-export-image__stamp">
                <span>Checklist do dia</span>
                <strong>{visibleMachineChecklistRecords.length} dispositivos</strong>
              </div>
            </header>

            <div className="schedule-export-image__metrics">
              {metrics.slice(0, 3).map((metric) => (
                <article key={metric.label} className="schedule-export-image__metric">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </article>
              ))}
            </div>

            <div className="schedule-export-image__machine-grid">
              {visibleMachineChecklistRecords.map((record) => {
                const isPresent = record.status === 'Presente';

                return (
                  <article
                    key={record.id}
                    className={`schedule-export-image__machine-card ${isPresent ? 'schedule-export-image__machine-card--present' : 'schedule-export-image__machine-card--absent'}`}
                  >
                    <strong className="schedule-export-image__machine-number">{record.device}</strong>
                    <span className={`schedule-export-image__machine-badge ${isPresent ? 'schedule-export-image__machine-badge--present' : 'schedule-export-image__machine-badge--absent'}`}>
                      {isPresent ? 'Presente' : 'Ausente'}
                    </span>
                  </article>
                );
              })}
            </div>

            <footer className="schedule-export-image__footer">
              <span>Gerado automaticamente pelo shell operacional</span>
              <strong>{session?.operatorName ?? session?.displayName ?? 'Operador local'}</strong>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default NativeModulePage;
