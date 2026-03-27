import MetricCard from '../../../components/common/MetricCard'

function FinanceSummaryCards({ items }) {
  return (
    <div className="finance-summary-grid">
      {items.map((item) => (
        <MetricCard
          key={item.id}
          label={item.label}
          value={item.value}
          meta={item.meta}
          className="finance-summary-card"
        />
      ))}
    </div>
  )
}

export default FinanceSummaryCards
