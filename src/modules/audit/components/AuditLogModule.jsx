import { useEffect, useMemo, useState } from 'react';

import MetricCard from '../../../components/common/MetricCard';
import SurfaceCard from '../../../components/common/SurfaceCard';
import { useStore } from '../../../contexts/StoreContext';
import { subscribeToAuditLogs } from '../../../services/auditLog';
import { firebaseReady } from '../../../services/firebase';
import Select from '../../../components/ui/Select';
import EmptyState from '../../../components/ui/EmptyState';

function asDate(value) {
  if (!value) {
    return null;
  }

  return typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
}

function formatDateTime(value) {
  const dateValue = asDate(value);

  if (!dateValue) {
    return '--';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateValue);
}

function isWithinPeriod(value, startDate, endDate) {
  const dateValue = asDate(value);

  if (!dateValue) {
    return false;
  }

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    if (dateValue < start) {
      return false;
    }
  }

  if (endDate) {
    const end = new Date(`${endDate}T23:59:59`);
    if (dateValue > end) {
      return false;
    }
  }

  return true;
}

function isCriticalAction(action) {
  const normalized = String(action ?? '').toLowerCase();
  return [
    'deleted',
    'cancel',
    'refund',
    'stock',
    'financial',
    'closure',
    'status',
  ].some((token) => normalized.includes(token));
}

function AuditLogModule() {
  const { currentStoreId } = useStore();
  const [events, setEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!firebaseReady || !currentStoreId) {
      setLoading(false);
      setEvents([]);
      return undefined;
    }

    setLoading(true);
    setErrorMessage('');

    return subscribeToAuditLogs(
      currentStoreId,
      (nextEvents) => {
        setEvents(nextEvents);
        setLoading(false);
      },
      (error) => {
        setErrorMessage(error.message ?? 'Nao foi possivel carregar o audit log.');
        setLoading(false);
      },
    );
  }, [currentStoreId]);

  const entityTypes = useMemo(
    () => Array.from(new Set(events.map((event) => event.entityType).filter(Boolean))).sort(),
    [events],
  );

  const visibleEvents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return events.filter((event) => {
      const matchesEntity = entityFilter === 'all' || event.entityType === entityFilter;
      const matchesPeriod = isWithinPeriod(event.createdAt, startDate, endDate);
      const matchesSearch = normalizedSearch.length === 0 || [
        event.actor?.name,
        event.action,
        event.entityType,
        event.entityId,
        event.description,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);

      return matchesEntity && matchesPeriod && matchesSearch;
    });
  }, [endDate, entityFilter, events, searchTerm, startDate]);

  const metrics = useMemo(() => {
    const actors = new Set(visibleEvents.map((event) => event.actor?.name).filter(Boolean));
    const criticalCount = visibleEvents.filter((event) => isCriticalAction(event.action)).length;
    const entities = new Set(visibleEvents.map((event) => event.entityType).filter(Boolean));

    return [
      {
        label: 'Eventos',
        value: String(visibleEvents.length).padStart(2, '0'),
        meta: 'rastros carregados no filtro atual',
        badgeText: 'audit',
        badgeClass: 'ui-badge--info',
      },
      {
        label: 'Atores',
        value: String(actors.size).padStart(2, '0'),
        meta: 'usuarios ou sistema com eventos registrados',
        badgeText: 'atores',
        badgeClass: 'ui-badge--success',
      },
      {
        label: 'Entidades',
        value: String(entities.size).padStart(2, '0'),
        meta: 'tipos de entidade tocados no periodo',
        badgeText: 'escopo',
        badgeClass: 'ui-badge--special',
      },
      {
        label: 'Criticos',
        value: String(criticalCount).padStart(2, '0'),
        meta: 'exclusoes, cancelamentos e ajustes sensiveis',
        badgeText: 'alerta',
        badgeClass: 'ui-badge--warning',
      },
    ];
  }, [visibleEvents]);

  if (!firebaseReady) {
    return (
      <SurfaceCard title="Audit log">
        <EmptyState message="Firebase nao configurado" />
      </SurfaceCard>
    );
  }

  if (!currentStoreId) {
    return (
      <SurfaceCard title="Audit log">
        <EmptyState message="Nenhuma store ativa" />
      </SurfaceCard>
    );
  }

  return (
    <section className="entity-module audit-log-module">
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

      <SurfaceCard title="Filtro do audit log">
        <div className="entity-toolbar audit-log-toolbar">
          <div className="ui-field">
            <label className="ui-label" htmlFor="audit-log-search">Buscar</label>
            <input
              id="audit-log-search"
              className="ui-input"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Actor, acao, entidade ou descricao"
            />
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor="audit-log-entity">Entidade</label>
            <Select
              id="audit-log-entity"
              className="ui-select"
              value={entityFilter}
              onChange={(event) => setEntityFilter(event.target.value)}
            >
              <option value="all">Todas</option>
              {entityTypes.map((entityType) => (
                <option key={entityType} value={entityType}>{entityType}</option>
              ))}
            </Select>
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor="audit-log-start">Inicio</label>
            <input
              id="audit-log-start"
              className="ui-input"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor="audit-log-end">Fim</label>
            <input
              id="audit-log-end"
              className="ui-input"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
        </div>
      </SurfaceCard>

      {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

      <SurfaceCard title="Eventos auditados">
        {loading ? (
          <EmptyState message="Carregando audit log..." />
        ) : visibleEvents.length === 0 ? (
          <EmptyState message="Nenhum evento encontrado" />
        ) : (
          <div className="entity-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Actor</th>
                  <th>Acao</th>
                  <th>Entidade</th>
                  <th>Registro</th>
                  <th>Descricao</th>
                </tr>
              </thead>
              <tbody>
                {visibleEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDateTime(event.createdAt)}</td>
                    <td className="ui-table__cell--strong">{event.actor?.name ?? 'Sistema'}</td>
                    <td>{event.action}</td>
                    <td>{event.entityType}</td>
                    <td>{event.entityId}</td>
                    <td>{event.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </section>
  );
}

export default AuditLogModule;


