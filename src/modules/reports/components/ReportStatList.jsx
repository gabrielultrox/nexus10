function ReportStatList({
  title,
  items,
  valueFormatter,
  metaFormatter,
}) {
  return (
    <section className="report-list surface-card">
      <div className="surface-card__content">
        <header className="report-list__header">
          <p className="text-overline">Report</p>
          <h3 className="text-section-title">{title}</h3>
        </header>

        {items.length === 0 ? (
          <div className="entity-empty-state">
            <p className="text-section-title">Sem dados no periodo</p>
          </div>
        ) : (
          <div className="report-list__items">
            {items.map((item, index) => (
              <article key={item.id ?? item.label} className="report-list__item">
                <div className="report-list__rank">{String(index + 1).padStart(2, '0')}</div>
                <div className="report-list__body">
                  <div className="report-list__top">
                    <strong>{item.label}</strong>
                    <span>{valueFormatter?.(item) ?? item.value ?? item.total ?? item.quantity ?? 0}</span>
                  </div>
                  {metaFormatter ? <small>{metaFormatter(item)}</small> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default ReportStatList;
