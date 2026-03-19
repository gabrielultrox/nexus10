import UIMetricCard from '../ui/MetricCard';

function resolveVariantFromBadgeClass(badgeClass = '') {
  if (badgeClass.includes('warning')) {
    return 'warning';
  }

  if (badgeClass.includes('danger')) {
    return 'danger';
  }

  if (badgeClass.includes('success')) {
    return 'success';
  }

  if (badgeClass.includes('info')) {
    return 'info';
  }

  return 'neutral';
}

function MetricCard({
  label,
  value,
  meta,
  badgeText,
  badgeClass,
  className = '',
  valueClassName = '',
  delta,
  description,
  variant,
}) {
  return (
    <UIMetricCard
      label={label}
      value={value}
      delta={delta}
      description={description ?? meta}
      variant={variant ?? resolveVariantFromBadgeClass(badgeClass)}
      badge={badgeText}
      className={className}
      valueClassName={valueClassName}
    />
  );
}

export default MetricCard;

