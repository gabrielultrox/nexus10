import MetricCard from '../common/MetricCard';

function DashboardKpiCard({ item }) {
  const valueText = String(item.value ?? '');
  const valueClassName = [
    valueText.includes('R$') ? 'dashboard-kpi-card__value--currency' : '',
    valueText.length >= 10 ? 'dashboard-kpi-card__value--compact' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <MetricCard
      label={item.label}
      value={item.value}
      meta={item.meta}
      badgeText={item.badgeText}
      badgeClass={item.badgeClass}
      className={`dashboard-kpi-card dashboard-kpi-card--${item.tone}`}
      valueClassName={valueClassName}
    />
  );
}

export default DashboardKpiCard;
