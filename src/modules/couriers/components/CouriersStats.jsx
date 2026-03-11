import MetricCard from '../../../components/common/MetricCard';

function CouriersStats({ items }) {
  return (
    <div className="couriers-stats-grid">
      {items.map((item) => (
        <MetricCard key={item.id} label={item.label} value={item.value} meta={item.meta} className="couriers-stat-card" />
      ))}
    </div>
  );
}

export default CouriersStats;
