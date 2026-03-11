function CouriersStats({ items }) {
  return (
    <div className="couriers-stats-grid">
      {items.map((item) => (
        <article key={item.id} className="couriers-stat-card">
          <div className="couriers-stat-card__value-row">
            <span className="couriers-stat-card__label">{item.label}</span>
            <strong className="couriers-stat-card__value">{item.value}</strong>
          </div>
          <p className="couriers-stat-card__meta">{item.meta}</p>
        </article>
      ))}
    </div>
  );
}

export default CouriersStats;
