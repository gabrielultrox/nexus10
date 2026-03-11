function FinanceIndicators({ items }) {
  return (
    <section className="finance-indicators-panel ui-card">
      <div className="finance-indicators-panel__inner">
        <header className="finance-panel-header">
          <p className="text-overline">Indicators</p>
          <h2 className="text-section-title">Indicadores Principais</h2>
        </header>

        <div className="finance-indicators-list">
          {items.map((item) => (
            <div key={item.id} className="finance-indicator-item">
              <div>
                <span className="finance-indicator-item__label">{item.label}</span>
                <strong className="finance-indicator-item__value">{item.value}</strong>
              </div>
              <span className={`ui-badge ${item.badgeClass}`}>{item.badgeText}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FinanceIndicators;
