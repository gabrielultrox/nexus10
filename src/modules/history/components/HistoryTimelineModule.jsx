import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import MetricCard from '../../../components/common/MetricCard';
import PageTabs from '../../../components/common/PageTabs';
import SurfaceCard from '../../../components/common/SurfaceCard';
import { loadAuditEvents } from '../../../services/localAudit';

const HISTORY_TABS = [
  { id: 'all', label: 'Tudo', modulePaths: [] },
  { id: 'cash', label: 'Caixa', modulePaths: ['cash'] },
  { id: 'machines', label: 'Maquininhas', modulePaths: ['machines', 'machine-history'] },
  { id: 'couriers', label: 'Entregadores', modulePaths: ['couriers'] },
  { id: 'schedule', label: 'Escala', modulePaths: ['schedule'] },
  { id: 'delivery-reading', label: 'Leitura', modulePaths: ['delivery-reading'] },
  { id: 'advances', label: 'Vales', modulePaths: ['advances'] },
  { id: 'discounts', label: 'Descontos', modulePaths: ['discounts'] },
  { id: 'change', label: 'Trocos', modulePaths: ['change'] },
  { id: 'map', label: 'Mapa', modulePaths: ['map'] },
  { id: 'occurrences', label: 'Ocorrencias', modulePaths: ['occurrences'] },
];

function toDayKey(timestamp) {
  return String(timestamp ?? '').slice(0, 10);
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

function formatMonthLabel(monthKey) {
  const [year, month] = String(monthKey).split('-');
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${year}-${month}-01T12:00:00`));
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function buildCalendarDays(monthKey, daysWithEvents) {
  if (!monthKey) {
    return [];
  }

  const [yearValue, monthValue] = monthKey.split('-').map(Number);
  const monthDate = new Date(yearValue, monthValue - 1, 1);
  const firstDayIndex = (monthDate.getDay() + 6) % 7;
  const daysInMonth = new Date(yearValue, monthValue, 0).getDate();
  const calendarDays = [];

  for (let index = 0; index < firstDayIndex; index += 1) {
    calendarDays.push({ id: `pad-start-${index}`, empty: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayKey = `${monthKey}-${String(day).padStart(2, '0')}`;
    calendarDays.push({
      id: dayKey,
      dayKey,
      label: String(day).padStart(2, '0'),
      hasEntry: daysWithEvents.has(dayKey),
    });
  }

  while (calendarDays.length % 7 !== 0) {
    calendarDays.push({ id: `pad-end-${calendarDays.length}`, empty: true });
  }

  return calendarDays;
}

function HistoryTimelineModule() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allEvents, setAllEvents] = useState(() => loadAuditEvents());
  const activeTabId = searchParams.get('screen') ?? HISTORY_TABS[0].id;
  const activeTab = HISTORY_TABS.find((tab) => tab.id === activeTabId) ?? HISTORY_TABS[0];

  useEffect(() => {
    function refreshEvents() {
      setAllEvents(loadAuditEvents());
    }

    refreshEvents();
    window.addEventListener('focus', refreshEvents);

    return () => window.removeEventListener('focus', refreshEvents);
  }, []);

  const filteredEvents = useMemo(() => {
    if (activeTab.modulePaths.length === 0) {
      return allEvents;
    }

    return allEvents.filter((event) => activeTab.modulePaths.includes(event.modulePath));
  }, [activeTab.modulePaths, allEvents]);

  const availableDays = useMemo(
    () => Array.from(new Set(filteredEvents.map((event) => toDayKey(event.timestamp)).filter(Boolean))).sort((left, right) => right.localeCompare(left)),
    [filteredEvents],
  );
  const selectedDay = searchParams.get('day') ?? availableDays[0] ?? '';
  const selectedMonth = searchParams.get('month') ?? selectedDay.slice(0, 7) ?? availableDays[0]?.slice(0, 7) ?? '';

  useEffect(() => {
    if (!availableDays.length) {
      return;
    }

    if (!selectedDay || !availableDays.includes(selectedDay)) {
      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams);
        nextParams.set('screen', activeTab.id);
        nextParams.set('day', availableDays[0]);
        nextParams.set('month', availableDays[0].slice(0, 7));
        return nextParams;
      });
    }
  }, [activeTab.id, availableDays, selectedDay, setSearchParams]);

  const visibleEvents = useMemo(
    () => filteredEvents.filter((event) => toDayKey(event.timestamp) === selectedDay),
    [filteredEvents, selectedDay],
  );

  const availableMonths = useMemo(
    () => Array.from(new Set(availableDays.map((dayKey) => dayKey.slice(0, 7)))).sort((left, right) => right.localeCompare(left)),
    [availableDays],
  );
  const activeDaysSet = useMemo(() => new Set(availableDays), [availableDays]);
  const calendarDays = useMemo(
    () => buildCalendarDays(selectedMonth, activeDaysSet),
    [activeDaysSet, selectedMonth],
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
        label: 'Eventos da categoria',
        value: String(filteredEvents.length).padStart(2, '0'),
        meta: 'historico visivel',
        badgeText: 'eventos',
        badgeClass: 'ui-badge--success',
      },
      {
        id: 'actors',
        label: 'Operadores',
        value: String(actors.size).padStart(2, '0'),
        meta: 'atores envolvidos',
        badgeText: 'atores',
        badgeClass: 'ui-badge--special',
      },
    ];
  }, [availableDays.length, filteredEvents]);

  function handleTabChange(tabId) {
    const nextTab = HISTORY_TABS.find((tab) => tab.id === tabId) ?? HISTORY_TABS[0];
    const nextEvents = nextTab.modulePaths.length === 0
      ? allEvents
      : allEvents.filter((event) => nextTab.modulePaths.includes(event.modulePath));
    const nextDays = Array.from(new Set(nextEvents.map((event) => toDayKey(event.timestamp)).filter(Boolean))).sort((left, right) => right.localeCompare(left));
    const nextDay = nextDays[0] ?? '';

    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set('screen', tabId);

      if (nextDay) {
        nextParams.set('day', nextDay);
        nextParams.set('month', nextDay.slice(0, 7));
      } else {
        nextParams.delete('day');
        nextParams.delete('month');
      }

      return nextParams;
    });
  }

  function handleDayChange(dayKey) {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set('screen', activeTab.id);
      nextParams.set('day', dayKey);
      nextParams.set('month', dayKey.slice(0, 7));
      return nextParams;
    });
  }

  function handleMonthChange(monthKey) {
    const nextDay = availableDays.find((dayKey) => dayKey.startsWith(monthKey))
      ?? `${monthKey}-01`;

    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set('screen', activeTab.id);
      nextParams.set('month', monthKey);
      nextParams.set('day', nextDay);
      return nextParams;
    });
  }

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

      <PageTabs
        tabs={HISTORY_TABS}
        activeTab={activeTab.id}
        onTabChange={handleTabChange}
      />

      <div className="history-module__layout">
        <SurfaceCard title="Calendario operacional">
          {availableMonths.length > 0 ? (
            <div className="history-module__calendar">
              <div className="ui-field">
                <label className="ui-label" htmlFor="history-month">
                  Mes
                </label>
                <select
                  id="history-month"
                  className="ui-select"
                  value={selectedMonth}
                  onChange={(event) => handleMonthChange(event.target.value)}
                >
                  {availableMonths.map((monthKey) => (
                    <option key={monthKey} value={monthKey}>
                      {formatMonthLabel(monthKey)}
                    </option>
                  ))}
                </select>
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
                      className={`history-module__calendar-day${day.dayKey === selectedDay ? ' history-module__calendar-day--selected' : ''}${day.hasEntry ? ' history-module__calendar-day--active' : ''}`}
                      onClick={() => handleDayChange(day.dayKey)}
                    >
                      {day.label}
                    </button>
                  )
                ))}
              </div>
            </div>
          ) : (
            <div className="module-empty-state">
              <p className="module-empty-state__text">Nenhum dia registrado</p>
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard title={selectedDay ? `Atividades de ${formatDayLabel(selectedDay)}` : 'Atividades'}>
          {visibleEvents.length === 0 ? (
            <div className="module-empty-state">
              <p className="module-empty-state__text">Nenhuma atividade nesta categoria</p>
            </div>
          ) : (
            <div className="history-module__timeline">
              {visibleEvents.map((event) => (
                <article key={event.id} className="history-module__entry">
                  <div className="history-module__entry-time">{formatTime(event.timestamp)}</div>
                  <div className="history-module__entry-content">
                    <div className="history-module__entry-header">
                      <strong>{event.action}</strong>
                      <span className="ui-badge ui-badge--info">{event.module}</span>
                    </div>
                    <p className="history-module__entry-meta">
                      {event.actor}
                      {event.target ? ` · ${event.target}` : ''}
                    </p>
                    {event.details ? (
                      <p className="history-module__entry-details">{event.details}</p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </SurfaceCard>
      </div>
    </section>
  );
}

export default HistoryTimelineModule;
