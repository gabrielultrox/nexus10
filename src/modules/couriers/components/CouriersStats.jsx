import MetricCard from '../../../components/common/MetricCard';

function CouriersStats({ items }) {
  return (
    <div className="card-grid">
      {items.map((item) => (
        <MetricCard
          key={item.id}
          label={item.label}
          value={item.value}
          meta={item.meta}
          badgeText={item.badgeText}
          badgeClass={item.badgeClass}
        />
      ))}
    </div>
  );
}

export default CouriersStats;
