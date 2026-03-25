import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import MetricCard from '../../../components/common/MetricCard';
import SurfaceCard from '../../../components/common/SurfaceCard';
import EmptyState from '../../../components/ui/EmptyState';
import { loadAuditEvents } from '../../../services/localAudit';
import { routeDefinitions } from '../../../utils/routeCatalog';

const PRIMARY_HISTORY_FILTERS = [
  { id: 'all', label: 'Todos', modulePaths: [] },
  { id: 'delivery-reading', label: 'Leitura', modulePaths: ['delivery-reading'] },
  { id: 'schedule', label: 'Escala', modulePaths: ['schedule'] },
  { id: 'advances', label: 'Vales', modulePaths: ['advances'] },
  { id: 'discounts', label: 'Descontos', modulePaths: ['discounts'] },
  { id: 'change', label: 'Trocos', modulePaths: ['change'] },
  { id: 'orders', label: 'Pedidos', modulePaths: ['orders'] },
  { id: 'sales', label: 'Vendas', modulePaths: ['sales'] },
  { id: 'cash', label: 'Caixa', modulePaths: ['cash'] },
];

const CONTEXT_HISTORY_FILTERS = [
  { id: 'couriers', label: 'Entregadores', modulePaths: ['couriers'] },
  { id: 'machines', label: 'Hardware', modulePaths: ['machines', 'machine-history'] },
];

const EVENT_TYPE_FILTERS = [
  { id: 'all', label: 'Tudo' },
  { id: 'create', label: 'Cadastros' },
  { id: 'update', label: 'Atualizacoes' },
  { id: 'delete', label: 'Exclusoes' },
  { id: 'reset', label: 'Resets' },
];

const ALL_HISTORY_FILTERS = [...PRIMARY_HISTORY_FILTERS, ...CONTEXT_HISTORY_FILTERS];

const MODULE_TONE_MAP = {
  cash: 'success',
  'delivery-reading': 'info',
  schedule: 'info',
  advances: 'warning',
  discounts: 'warning',
  change: 'warning',
  orders: 'danger',
  sales: 'success',
  couriers: 'neutral',
  machines: 'info',
  'machine-history': 'info',
};

function toDayKey(timestamp) {
  return String(timestamp ?? '').slice(0, 10);
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDayLabel(dayKey) {
  if (!dayKey) {
    return '--';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dayKey}T12:00:00`)).replace(/\./g, '');
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function buildModuleTone(modulePath) {
  return MODULE_TONE_MAP[modulePath] ?? 'neutral';
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function buildCalendarDays(baseDayKey, eventsByDay) {
  const referenceDay = baseDayKey ? new Date(`${baseDayKey}T12:00:00`) : new Date();
  const year = referenceDay.getFullYear();
  const month = referenceDay.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstDayIndex = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];

  for (let index = 0; index < firstDayIndex; index += 1) {
    days.push({ id: `pad-${index}`, empty: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = eventsByDay.get(dayKey) ?? [];
    const tones = Array.from(new Set(dayEvents.map((event) => buildModuleTone(event.modulePath)))).slice(0, 3);

    days.push({
      id: dayKey,
      dayKey,
      label: String(day).padStart(2, '0'),
      tones,
      hasEntry: tones.length > 0,
    });
  }

  while (days.length % 7 !== 0) {
    days.push({ id: `pad-end-${days.length}`, empty: true });
  }

  return days;
}

function buildQueryFilter(searchParams) {
  const requested = searchParams.get('modulo') ?? searchParams.get('screen') ?? 'all';
  return ALL_HISTORY_FILTERS.find((filter) => filter.id === requested) ?? PRIMARY_HISTORY_FILTERS[0];
}

function buildEventTypeFilter(searchParams) {
  const requested = searchParams.get('tipo') ?? 'all';
  return EVENT_TYPE_FILTERS.find((filter) => filter.id === requested) ?? EVENT_TYPE_FILTERS[0];
}

function buildSelectedDay(searchParams, availableDays) {
  const requestedDay = searchParams.get('data') ?? searchParams.get('day') ?? 'hoje';
  const todayKey = getTodayKey();

  if (requestedDay === 'hoje') {
    return todayKey;
  }

  if (availableDays.includes(requestedDay)) {
    return requestedDay;
  }

  return availableDays[0] ?? todayKey;
}

function groupEventsByHour(events) {
  const groups = [];

  events.forEach((event) => {
    const hourKey = formatTime(event.timestamp).slice(0, 2);
    const displayHour = `${hourKey}:00`;
    const existingGroup = groups.find((group) => group.hour === displayHour);

    if (existingGroup) {
      existingGroup.events.push(event);
      return;
    }

    groups.push({
      hour: displayHour,
      events: [event],
    });
  });

  return groups;
}

function categorizeEvent(event) {
  const action = normalizeText(event.action);

  if (
    action.includes('excluiu')
    || action.includes('removeu')
    || action.includes('cancelou')
  ) {
    return 'delete';
  }

  if (
    action.includes('reset')
    || action.includes('limpou')
    || action.includes('reinici')
  ) {
    return 'reset';
  }

  if (
    action.includes('criou')
    || action.includes('cadastrou')
    || action.includes('registr')
    || action.includes('abertura')
    || action.includes('gerou')
  ) {
    return 'create';
  }

  return 'update';
}

function eventMatchesType(event, activeType) {
  if (activeType.id === 'all') {
    return true;
  }

  return categorizeEvent(event) === activeType.id;
}

function buildSearchBlob(event) {
  return normalizeText([
    event.module,
    event.modulePath,
    event.actor,
    event.action,
    event.target,
    event.details,
    event.value,
    event.courier,
  ].filter(Boolean).join(' '));
}

function eventMatchesQuery(event, query) {
  if (!query) {
    return true;
  }

  return buildSearchBlob(event).includes(normalizeText(query));
}

function findRouteForModule(modulePath) {
  return routeDefinitions.find((route) => route.path === modulePath) ?? null;
}

function buildOriginLink(event) {
  const route = findRouteForModule(event.modulePath);

  if (!route) {
    return null;
  }

  if (route.path === 'orders') {
    const orderId = event.orderId ?? event.entityId ?? '';

    return {
      to: orderId ? `/orders/${orderId}` : `/${route.path}`,
      label: route.label,
    };
  }

  if (route.path === 'sales') {
    const saleId = event.saleId ?? event.entityId ?? '';

    return {
      to: saleId ? `/sales/${saleId}` : `/${route.path}`,
      label: route.label,
    };
  }

  const recordId = event.recordId ?? event.entityId ?? '';

  if (recordId) {
    return {
      to: `/${route.path}?recordId=${encodeURIComponent(recordId)}`,
      label: route.label,
    };
  }

  return {
    to: `/${route.path}`,
    label: route.label,
  };
}

function buildEventText(event) {
  if (event.target) {
    return `${event.action} - ${event.target}`;
  }

  return event.action;
}

function extractValueFromLegacyText(...values) {
  const combined = values.filter(Boolean).join(' ');
  const currencyMatch = combined.match(/R\$\s*\d[\d.,]*/i);

  if (currencyMatch) {
    return currencyMatch[0].replace(/\s+/g, ' ').trim();
  }

  return '';
}

function extractCourierFromLegacyText(event) {
  const explicitTarget = event.target?.trim() ?? '';

  if (explicitTarget && explicitTarget !== 'registro manual' && explicitTarget !== 'entregador') {
    return explicitTarget;
  }

  const combined = [event.details, event.action].filter(Boolean).join(' ');
  const patterns = [
    /(?:para|retornado para)\s+([^.,|]+)/i,
    /(?:entregador:)\s*([^.,|]+)/i,
  ];

  for (const pattern of patterns) {
    const match = combined.match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return '';
}

function buildFinancialAuditContext(event) {
  if (event.modulePath !== 'change' && event.modulePath !== 'advances') {
    return null;
  }

  const courier = event.courier ?? extractCourierFromLegacyText(event);
  const value = event.value ?? extractValueFromLegacyText(event.details, event.action, event.target);

  if (!courier && !value) {
    return null;
  }

  return { courier, value };
}

function HistoryTimelineModule() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allEvents, setAllEvents] = useState(() => loadAuditEvents());
  const [collapsedHours, setCollapsedHours] = useState({});

  const activeFilter = useMemo(() => buildQueryFilter(searchParams), [searchParams]);
  const activeTypeFilter = useMemo(() => buildEventTypeFilter(searchParams), [searchParams]);
  const searchQuery = searchParams.get('q') ?? '';

  useEffect(() => {
    function refreshEvents() {
      setAllEvents(loadAuditEvents());
    }

    refreshEvents();
    window.addEventListener('focus', refreshEvents);

    return () => window.removeEventListener('focus', refreshEvents);
  }, []);

  const moduleFilteredEvents = useMemo(() => {
    if (activeFilter.modulePaths.length === 0) {
      return allEvents;
    }

    return allEvents.filter((event) => activeFilter.modulePaths.includes(event.modulePath));
  }, [activeFilter.modulePaths, allEvents]);

  const refinedEvents = useMemo(
    () => moduleFilteredEvents.filter((event) => eventMatchesType(event, activeTypeFilter) && eventMatchesQuery(event, searchQuery)),
    [activeTypeFilter, moduleFilteredEvents, searchQuery],
  );

  const availableDays = useMemo(
    () => Array.from(new Set(refinedEvents.map((event) => toDayKey(event.timestamp)).filter(Boolean))).sort((left, right) => right.localeCompare(left)),
    [refinedEvents],
  );

  const selectedDay = useMemo(
    () => buildSelectedDay(searchParams, availableDays),
    [availableDays, searchParams],
  );

  useEffect(() => {
    if (!selectedDay) {
      return;
    }

    setSearchParams((currentParams) => {
      const currentModule = currentParams.get('modulo') ?? 'all';
      const currentType = currentParams.get('tipo') ?? 'all';
      const currentDay = currentParams.get('data') ?? 'hoje';
      const currentQuery = currentParams.get('q') ?? '';

      if (
        currentModule === activeFilter.id
        && currentType === activeTypeFilter.id
        && currentDay === selectedDay
        && currentQuery === searchQuery
      ) {
        return currentParams;
      }

      const nextParams = new URLSearchParams(currentParams);
      nextParams.set('modulo', activeFilter.id);
      nextParams.set('tipo', activeTypeFilter.id);
      nextParams.set('data', selectedDay);

      if (!searchQuery) {
        nextParams.delete('q');
      }

      return nextParams;
    });
  }, [activeFilter.id, activeTypeFilter.id, searchQuery, selectedDay, setSearchParams]);

  const visibleEvents = useMemo(
    () => refinedEvents
      .filter((event) => toDayKey(event.timestamp) === selectedDay)
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp)),
    [refinedEvents, selectedDay],
  );

  const eventsByDay = useMemo(() => {
    const nextMap = new Map();

    refinedEvents.forEach((event) => {
      const dayKey = toDayKey(event.timestamp);
      const currentEvents = nextMap.get(dayKey) ?? [];
      currentEvents.push(event);
      nextMap.set(dayKey, currentEvents);
    });

    return nextMap;
  }, [refinedEvents]);

  const calendarDays = useMemo(
    () => buildCalendarDays(selectedDay || getTodayKey(), eventsByDay),
    [eventsByDay, selectedDay],
  );

  const groupedEvents = useMemo(
    () => groupEventsByHour(visibleEvents),
    [visibleEvents],
  );

  const metrics = useMemo(() => {
    const actors = new Set(refinedEvents.map((event) => event.actor).filter(Boolean));
    const currentDayTotal = visibleEvents.length;

    return [
      {
        id: 'days',
        label: 'Dias visiveis',
        value: String(availableDays.length).padStart(2, '0'),
        meta: 'no filtro atual',
        badgeText: 'dias',
        badgeClass: 'ui-badge--info',
      },
      {
        id: 'events',
        label: 'Eventos do dia',
        value: String(currentDayTotal).padStart(2, '0'),
        meta: selectedDay === getTodayKey() ? 'hoje' : 'data ativa',
        badgeText: 'timeline',
        badgeClass: 'ui-badge--success',
      },
      {
        id: 'actors',
        label: 'Operadores',
        value: String(actors.size).padStart(2, '0'),
        meta: 'na auditoria',
        badgeText: 'atores',
        badgeClass: 'ui-badge--special',
      },
    ];
  }, [availableDays.length, refinedEvents, selectedDay, visibleEvents.length]);

  const updateParams = useCallback((nextValues) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);

      if (nextValues.modulo) {
        nextParams.set('modulo', nextValues.modulo);
      }

      if (nextValues.tipo) {
        nextParams.set('tipo', nextValues.tipo);
      }

      if (nextValues.data) {
        nextParams.set('data', nextValues.data);
      }

      if ('q' in nextValues) {
        if (nextValues.q) {
          nextParams.set('q', nextValues.q);
        } else {
          nextParams.delete('q');
        }
      }

      return nextParams;
    });
  }, [setSearchParams]);

  const handleDayChange = useCallback((dayKey) => {
    updateParams({ data: dayKey });
  }, [updateParams]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }

      const currentIndex = availableDays.indexOf(selectedDay);

      if (currentIndex === -1) {
        return;
      }

      const nextIndex = event.key === 'ArrowLeft'
        ? Math.min(currentIndex + 1, availableDays.length - 1)
        : Math.max(currentIndex - 1, 0);

      if (nextIndex === currentIndex) {
        return;
      }

      event.preventDefault();
      handleDayChange(availableDays[nextIndex]);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [availableDays, handleDayChange, selectedDay]);

  function handleFilterChange(filterId) {
    const nextFilter = ALL_HISTORY_FILTERS.find((filter) => filter.id === filterId) ?? PRIMARY_HISTORY_FILTERS[0];
    const nextEvents = nextFilter.modulePaths.length === 0
      ? allEvents
      : allEvents.filter((event) => nextFilter.modulePaths.includes(event.modulePath));
    const nextRefined = nextEvents.filter((event) => eventMatchesType(event, activeTypeFilter) && eventMatchesQuery(event, searchQuery));
    const nextDays = Array.from(new Set(nextRefined.map((event) => toDayKey(event.timestamp)).filter(Boolean))).sort((left, right) => right.localeCompare(left));
    const todayKey = getTodayKey();
    const nextDay = nextDays.includes(selectedDay) ? selectedDay : (nextDays.includes(todayKey) ? todayKey : nextDays[0] ?? todayKey);

    updateParams({ modulo: filterId, data: nextDay });
  }

  function handleTypeFilterChange(typeId) {
    const nextType = EVENT_TYPE_FILTERS.find((filter) => filter.id === typeId) ?? EVENT_TYPE_FILTERS[0];
    const nextRefined = moduleFilteredEvents.filter((event) => eventMatchesType(event, nextType) && eventMatchesQuery(event, searchQuery));
    const nextDays = Array.from(new Set(nextRefined.map((event) => toDayKey(event.timestamp)).filter(Boolean))).sort((left, right) => right.localeCompare(left));
    const todayKey = getTodayKey();
    const nextDay = nextDays.includes(selectedDay) ? selectedDay : (nextDays.includes(todayKey) ? todayKey : nextDays[0] ?? todayKey);

    updateParams({ tipo: typeId, data: nextDay });
  }

  function handleSearchChange(event) {
    const nextQuery = event.target.value;
    const nextRefined = moduleFilteredEvents.filter((auditEvent) => (
      eventMatchesType(auditEvent, activeTypeFilter) && eventMatchesQuery(auditEvent, nextQuery)
    ));
    const nextDays = Array.from(new Set(nextRefined.map((auditEvent) => toDayKey(auditEvent.timestamp)).filter(Boolean))).sort((left, right) => right.localeCompare(left));
    const todayKey = getTodayKey();
    const nextDay = nextDays.includes(selectedDay) ? selectedDay : (nextDays.includes(todayKey) ? todayKey : nextDays[0] ?? todayKey);

    updateParams({ q: nextQuery, data: nextDay });
  }

  function handleHourToggle(hourKey) {
    setCollapsedHours((current) => ({
      ...current,
      [hourKey]: !current[hourKey],
    }));
  }

  const visibleFilterChips = useMemo(() => {
    const baseFilters = [...PRIMARY_HISTORY_FILTERS];

    if (!PRIMARY_HISTORY_FILTERS.some((filter) => filter.id === activeFilter.id) && activeFilter.id !== 'all') {
      baseFilters.push(activeFilter);
    }

    return baseFilters;
  }, [activeFilter]);

  return (
    <section className="history-module">
      <div className="card-grid history-module__metrics">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.id}
            label={metric.label}
            value={metric.value}
            meta={metric.meta}
            badgeText={metric.badgeText}
            badgeClass={metric.badgeClass}
          />
        ))}
      </div>

      <div className="history-module__filters">
        <div className="history-module__chips" role="tablist" aria-label="Filtro rapido do historico">
          {visibleFilterChips.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`history-module__chip${activeFilter.id === filter.id ? ' is-active' : ''}`}
              onClick={() => handleFilterChange(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="history-module__toolbar">
          <div className="history-module__search">
            <input
              className="ui-input"
              type="search"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Buscar por operador, acao, alvo ou detalhe"
            />
          </div>

          <div className="history-module__quick-filters" role="tablist" aria-label="Filtro de tipo de evento">
            {EVENT_TYPE_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`history-module__quick-chip${activeTypeFilter.id === filter.id ? ' is-active' : ''}`}
                onClick={() => handleTypeFilterChange(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="history-module__summary">
            <span>{visibleEvents.length} no dia</span>
            <span>{refinedEvents.length} no filtro</span>
          </div>
        </div>
      </div>

      <div className="history-module__layout">
        <SurfaceCard title="Calendario operacional">
          {calendarDays.length > 0 ? (
            <div className="history-module__calendar">
              <div className="history-module__calendar-nav">
                <button
                  type="button"
                  className="history-module__calendar-arrow"
                  disabled={availableDays.length === 0 || availableDays.indexOf(selectedDay) === availableDays.length - 1}
                  onClick={() => {
                    const currentIndex = availableDays.indexOf(selectedDay);
                    const nextDay = currentIndex < availableDays.length - 1 ? availableDays[currentIndex + 1] : selectedDay;
                    if (nextDay && nextDay !== selectedDay) {
                      handleDayChange(nextDay);
                    }
                  }}
                  aria-label="Dia anterior"
                >
                  {'<'}
                </button>
                <strong>{selectedDay ? formatDayLabel(selectedDay) : 'Sem data'}</strong>
                <button
                  type="button"
                  className="history-module__calendar-arrow"
                  disabled={availableDays.length === 0 || availableDays.indexOf(selectedDay) <= 0}
                  onClick={() => {
                    const currentIndex = availableDays.indexOf(selectedDay);
                    const nextDay = currentIndex > 0 ? availableDays[currentIndex - 1] : selectedDay;
                    if (nextDay && nextDay !== selectedDay) {
                      handleDayChange(nextDay);
                    }
                  }}
                  aria-label="Proximo dia"
                >
                  {'>'}
                </button>
              </div>

              <div className="history-module__weekday-row">
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'].map((dayLabel) => (
                  <span key={dayLabel}>{dayLabel}</span>
                ))}
              </div>

              <div className="history-module__calendar-grid">
                {calendarDays.map((day) => (
                  day.empty ? (
                    <span key={day.id} className="history-module__calendar-pad" />
                  ) : (
                    <button
                      key={day.id}
                      type="button"
                      className={`history-module__calendar-day${day.dayKey === selectedDay ? ' history-module__calendar-day--selected' : ''}`}
                      onClick={() => handleDayChange(day.dayKey)}
                    >
                      <span>{day.label}</span>
                      <span className="history-module__calendar-dots" aria-hidden="true">
                        {day.hasEntry
                          ? day.tones.map((tone) => (
                            <span key={`${day.id}-${tone}`} className={`history-module__calendar-dot history-module__calendar-dot--${tone}`} />
                          ))
                          : null}
                      </span>
                    </button>
                  )
                ))}
              </div>
            </div>
          ) : (
            <EmptyState message="Nenhum dia registrado" />
          )}
        </SurfaceCard>

        <SurfaceCard title={selectedDay ? `Atividades de ${formatDayLabel(selectedDay)}` : 'Atividades'}>
          {visibleEvents.length === 0 ? (
            <EmptyState message="Nenhuma atividade neste recorte" />
          ) : (
            <div key={`${activeFilter.id}-${activeTypeFilter.id}-${selectedDay}-${searchQuery}`} className="history-module__timeline history-module__timeline--animated">
              {groupedEvents.map((group) => {
                const isCollapsible = group.events.length > 5;
                const isCollapsed = Boolean(collapsedHours[group.hour]);
                const visibleGroupEvents = isCollapsible && isCollapsed ? group.events.slice(0, 5) : group.events;

                return (
                  <section key={group.hour} className="history-module__hour-group">
                    <header className="history-module__hour-header">
                      <div className="history-module__hour-copy">
                        <strong>{group.hour}</strong>
                        <span>{group.events.length} evento(s)</span>
                      </div>
                      {isCollapsible ? (
                        <button
                          type="button"
                          className="history-module__hour-toggle"
                          onClick={() => handleHourToggle(group.hour)}
                        >
                          {isCollapsed ? `Mostrar ${group.events.length - 5} mais` : 'Ocultar'}
                        </button>
                      ) : null}
                    </header>

                    <div className="history-module__hour-events">
                      {visibleGroupEvents.map((event) => {
                        const originLink = buildOriginLink(event);
                        const category = categorizeEvent(event);
                        const financialContext = buildFinancialAuditContext(event);

                        return (
                          <article key={event.id} className={`history-module__entry history-module__entry--${category}`}>
                            <span className="history-module__entry-time">{formatTime(event.timestamp)}</span>
                            <div className="history-module__entry-content">
                              <div className="history-module__entry-top">
                                <div className="history-module__entry-badges">
                                  <span className={`ui-badge ui-badge--${buildModuleTone(event.modulePath)}`}>{event.module}</span>
                                  {event.actor ? <span className="history-module__actor">{event.actor}</span> : null}
                                </div>
                                {originLink ? (
                                  <Link className="history-module__origin-link" to={originLink.to}>
                                    Abrir {originLink.label}
                                  </Link>
                                ) : null}
                              </div>
                              <p className="history-module__entry-description">{buildEventText(event)}</p>
                              {financialContext ? (
                                <div className="history-module__entry-finance">
                                  {financialContext.value ? (
                                    <span className="history-module__entry-chip history-module__entry-chip--value">
                                      Valor: {financialContext.value}
                                    </span>
                                  ) : null}
                                  {financialContext.courier ? (
                                    <span className="history-module__entry-chip history-module__entry-chip--courier">
                                      Entregador: {financialContext.courier}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                              <div className="history-module__entry-meta">
                                {event.target ? <span>Alvo: {event.target}</span> : null}
                                <span>Tipo: {EVENT_TYPE_FILTERS.find((filter) => filter.id === category)?.label ?? 'Atualizacoes'}</span>
                              </div>
                              {event.details ? <p className="history-module__entry-details">{event.details}</p> : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </SurfaceCard>
      </div>
    </section>
  );
}

export default HistoryTimelineModule;
