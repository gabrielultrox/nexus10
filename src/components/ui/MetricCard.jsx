import StatusBadge from './StatusBadge';

function resolveDeltaVariant(delta = '') {
  const normalized = String(delta).trim();

  if (normalized.startsWith('+')) {
    return 'metric-card__delta--positive';
  }

  if (normalized.startsWith('-')) {
    return 'metric-card__delta--negative';
  }

  return 'metric-card__delta--neutral';
}

function MetricCard({
  label,
  value,
  delta,
  description,
  variant = 'neutral',
  className = '',
  valueClassName = '',
  badge,
  badgeSize = 'sm',
}) {
  const composedClassName = ['metric-card', `metric-card--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={composedClassName}>
      <div className="metric-card__head">
        <p className="metric-card__label">{label}</p>
        {badge ? <StatusBadge status={badge} size={badgeSize} /> : null}
      </div>
      <div className={['metric-card__value', valueClassName].filter(Boolean).join(' ')}>
        {value}
      </div>
      {delta ? (
        <p className={['metric-card__delta', resolveDeltaVariant(delta)].join(' ')}>
          {delta}
        </p>
      ) : null}
      {description ? <p className="metric-card__description">{description}</p> : null}
    </article>
  );
}

export default MetricCard;

