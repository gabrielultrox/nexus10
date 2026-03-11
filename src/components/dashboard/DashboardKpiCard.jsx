import MetricCard from '../common/MetricCard';

function DashboardKpiCard({ item }) {
  return (
    <MetricCard
      label={item.label}
      value={item.value}
      meta={item.meta}
      badgeText={item.badgeText}
      badgeClass={item.badgeClass}
      className={`dashboard-kpi-card dashboard-kpi-card--${item.tone}`}
    />
  );
}

export default DashboardKpiCard;
