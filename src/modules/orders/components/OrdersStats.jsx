import MetricCard from '../../../components/common/MetricCard';

function OrdersStats({ items }) {
  return (
    <div className="orders-stats-grid">
      {items.map((item) => (
        <MetricCard key={item.id} label={item.label} value={item.value} meta={item.meta} className="orders-stat-card" />
      ))}
    </div>
  );
}

export default OrdersStats;
