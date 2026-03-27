import SurfaceCard from '../common/SurfaceCard'
import DashboardSectionHeader from './DashboardSectionHeader'
import TrendAreaChart from './TrendAreaChart'
import HourlyBarChart from './HourlyBarChart'

function DashboardCharts({ charts }) {
  const primaryChart = charts.primary
  const secondaryChart = charts.secondary

  return (
    <section className="dashboard-section">
      <DashboardSectionHeader title="Performance" />

      <div className="dashboard-chart-grid">
        <SurfaceCard title={primaryChart.title}>
          {primaryChart.kind === 'trend' ? (
            <TrendAreaChart data={primaryChart.data} />
          ) : (
            <HourlyBarChart data={primaryChart.data} />
          )}
        </SurfaceCard>

        <SurfaceCard title={secondaryChart.title}>
          {secondaryChart.kind === 'bar' ? (
            <HourlyBarChart data={secondaryChart.data} />
          ) : (
            <TrendAreaChart data={secondaryChart.data} />
          )}
        </SurfaceCard>
      </div>
    </section>
  )
}

export default DashboardCharts
