import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import MetricCard from '../../../components/common/MetricCard';
import SurfaceCard from '../../../components/common/SurfaceCard';
import EmptyState from '../../../components/ui/EmptyState';
import { loadAuditEvents } from '../../../services/localAudit';

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

function buildSelectedDay(searchParams, availableDays) {
  const requestedDay = searchParams.get('data') ?? searchParams.get('day') ?? 'hoje';

  if (requestedDay === 'hoje') {
    const todayKey = getTodayKey();
    return availableDays.includes(todayKey) ? todayKey : availableDays[0] ?? '';
  }

  if (availableDays.includes(requestedDay)) {
    return requestedDay;
  }

  return availableDays[0] ?? '';
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

function buildEventText(event) {
  const target = event.target ? ` · ${event.target}` : '';
  return `${event.action}${target}`;
}

function HistoryTimelineModule() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allEvents, setAllEvents] = useState(() => loadAuditEvents());
  const [collapsedHours, setCollapsedHours] = useState({});

  const activeFilter = useMemo(() => buildQueryFilter(searchParams), [searchParams]);

  useEffect(() => {
    function refreshEvents() {
      setAllEvents(loadAuditEvents());
    }

    refreshEvents();
    window.addEventListener('focus', refreshEvents);

    return () => window.removeEventListener('focus', refreshEvents);
  }, []);

  const filteredEvents = useMemo(() => {
    if (activeFilter.modulePaths.length === 0) {
      return allEvents;
    }

    return allEvents.filter((event) => activeFilter.modulePaths.includes(event.modulePath));
  }, [activeFilter.modulePaths, allEvents]);

  const availableDays = useMemo(
    () => Array.from(new Set(filteredEvents.map((event) => toDayKey(event.timestamp)).filter(Boolean))).sort((left, right) => right.localeCompare(left)),
    [filteredEvents],
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
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set('modulo', activeFilter.id);
      nextParams.set('data', selectedDay);
      return nextParams;
    });
  }, [activeFilter.id, selectedDay, setSearchParams]);

  const visibleEvents = useMemo(
    () => filteredEvents
      .filter((event) => toDayKey(event.timestamp) === selectedDay)
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp)),
    [filteredEvents, selectedDay],
  );

  const eventsByDay = useMemo(() => {
    const nextMap = new Map();

    filteredEvents.forEach((event) => {
      const dayKey = toDayKey(event.timestamp);
      const currentEvents = nextMap.get(dayKey) ?? [];
      currentEvents.push(event);
      nextMap.set(dayKey, currentEvents);
    });

    return nextMap;
  }, [filteredEvents]);

  const calendarDays = useMemo(
    () => buildCalendarDays(selectedDay || getTodayKey(), eventsByDay),
    [eventsByDay, selectedDay],
  );

  const groupedEvents = useMemo(
    () => groupEventsByHour(visibleEvents),
    [visibleEvents],
  );

  const metrics = useMemo(() => {
    const actors = new Set(filteredEvents.map((event) => event.actor).filter(Boolean));

    return [
      {
        id: 'days',
        label: 'Dias com atividade',
        value: String(availableDays.length).padStart(2, '0'),
        meta: 'dias gravados',
        badgeText: 'dias',
        badgeClass: 'ui-badge--info',
      },
      {
        id: 'events',
        label: 'Eventos filtrados',
        value: String(filteredEvents.length).padStart(2, '0'),
        meta: 'na timeline',
        badgeText: 'eventos',
        badgeClass: 'ui-badge--success',
      },
      {
        id: 'actors',
        label: 'Operadores',
        value: String(actors.size).padStart(2, '0'),
        meta: 'na leitura',
        badgeText: 'atores',
        badgeClass: 'ui-badge--special',
      },
    ];
  }, [availableDays.length, filteredEvents]);

  const updateParams = useCallback((nextFilterId, nextDay) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set('modulo', nextFilterId);
      nextParams.set('data', nextDay);
      return nextParams;
    });
  }, [setSearchParams]);

  const handleDayChange = useCallback((dayKey) => {
    updateParams(activeFilter.id, dayKey);
  }, [activeFilter.id, updateParams]);

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
    const nextDays = Array.from(new Set(nextEvents.map((event) => toDayKey(event.timestamp)).filter(Boolean))).sort((left, right) => right.localeCompare(left));
    const nextDay = nextDays.includes(selectedDay) ? selectedDay : (nextDays.includes(getTodayKey()) ? getTodayKey() : nextDays[0] ?? '');

    updateParams(filterId, nextDay);
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

      <div className="history-module__layout">
        <SurfaceCard title="Calendario operacional">
          {calendarDays.length > 0 ? (
            <div className="history-module__calendar">
              <div className="history-module__calendar-nav">
                <button
                  type="button"
                  className="history-module__calendar-arrow"
                  onClick={() => {
                    const currentIndex = availableDays.indexOf(selectedDay);
                    const nextDay = currentIndex < availableDays.length - 1 ? availableDays[currentIndex + 1] : selectedDay;
                    if (nextDay && nextDay !== selectedDay) {
                      handleDayChange(nextDay);
                    }
                  }}
                  aria-label="Dia anterior"
                >
                  ←
                </button>
                <strong>{selectedDay ? formatDayLabel(selectedDay) : 'Sem data'}</strong>
                <button
                  type="button"
                  className="history-module__calendar-arrow"
                  onClick={() => {
                    const currentIndex = availableDays.indexOf(selectedDay);
                    const nextDay = currentIndex > 0 ? availableDays[currentIndex - 1] : selectedDay;
                    if (nextDay && nextDay !== selectedDay) {
                      handleDayChange(nextDay);
                    }
                  }}
                  aria-label="Proximo dia"
                >
                  →
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
            <EmptyState message="Nenhuma atividade neste dia" />
          ) : (
            <div key={`${activeFilter.id}-${selectedDay}`} className="history-module__timeline history-module__timeline--animated">
              {groupedEvents.map((group) => {
                const isCollapsible = group.events.length > 5;
                const isCollapsed = Boolean(collapsedHours[group.hour]);
                const visibleGroupEvents = isCollapsible && isCollapsed ? group.events.slice(0, 5) : group.events;

                return (
                  <section key={group.hour} className="history-module__hour-group">
                    <header className="history-module__hour-header">
                      <strong>{group.hour}</strong>
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
                      {visibleGroupEvents.map((event) => (
                        <article key={event.id} className="history-module__entry">
                          <span className="history-module__entry-time">{formatTime(event.timestamp)}</span>
                          <div className="history-module__entry-content">
                            <span className={`ui-badge ui-badge--${buildModuleTone(event.modulePath)}`}>{event.module}</span>
                            <p className="history-module__entry-description">{buildEventText(event)}</p>
                            {event.details ? <p className="history-module__entry-details">{event.details}</p> : null}
                          </div>
                        </article>
                      ))}
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
