import EmptyState from '../../../components/ui/EmptyState';

function ReportBarChart({
  title,
  items,
  maxValue,
  valueFormatter,
  metaFormatter,
}) {
  const resolvedMaxValue = maxValue || Math.max(...items.map((item) => item.value || item.total || item.quantity || 0), 1);

  return (
    <section className="report-chart ui-card">
      <div className="report-chart__inner">
        <header className="report-chart__header">
          <p className="text-overline">Report</p>
          <h2 className="text-section-title">{title}</h2>
        </header>

        <div className="report-chart__list">
          {items.length === 0 ? (
            <EmptyState message="Sem dados no periodo" />
          ) : items.map((item) => {
            const numericValue = item.value ?? item.total ?? item.quantity ?? 0;
            const width = resolvedMaxValue > 0 ? Math.max((numericValue / resolvedMaxValue) * 100, 6) : 0;

            return (
              <article key={item.id ?? item.label} className="report-chart__item">
                <div className="report-chart__item-top">
                  <strong>{item.label}</strong>
                  <span>{valueFormatter?.(item) ?? numericValue}</span>
                </div>
                <div className="report-chart__bar-track">
                  <div className="report-chart__bar-fill" style={{ width: `${width}%` }} />
                </div>
                {metaFormatter ? <small>{metaFormatter(item)}</small> : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default ReportBarChart;

