import DashboardKpiCard from './DashboardKpiCard'

function DashboardKpiGrid({ items }) {
  return (
    <section className="dashboard-kpi-grid">
      {items.map((item) => (
        <DashboardKpiCard key={item.id} item={item} />
      ))}
    </section>
  )
}

export default DashboardKpiGrid
