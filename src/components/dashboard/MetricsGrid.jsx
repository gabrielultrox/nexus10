import { MetricCard } from '../ui'

function MetricsGrid({ items = [] }) {
  return (
    <section className="dashboard-analytics-metrics" aria-label="KPIs analiticos">
      {items.map((item) => (
        <MetricCard
          key={item.id}
          label={item.label}
          value={item.value}
          delta={item.delta}
          description={item.description}
          variant={item.variant}
          badge={item.badge}
        />
      ))}
    </section>
  )
}

export default MetricsGrid
