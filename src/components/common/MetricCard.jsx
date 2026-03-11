function MetricCard({
  label,
  value,
  meta,
  badgeText,
  badgeClass,
  className = '',
  valueClassName = '',
}) {
  return (
    <article className={`ui-kpi-card ${className}`.trim()}>
      <div className="ui-kpi-card__top">
        <p className="ui-kpi-card__label">{label}</p>
        {badgeText ? <span className={`ui-badge ${badgeClass}`}>{badgeText}</span> : null}
      </div>

      <div className={`ui-kpi-card__value ${valueClassName}`.trim()}>{value}</div>
      {meta ? <p className="ui-kpi-card__meta">{meta}</p> : null}
    </article>
  );
}

export default MetricCard;
