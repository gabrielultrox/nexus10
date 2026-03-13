import SurfaceCard from '../common/SurfaceCard';
import DashboardSectionHeader from './DashboardSectionHeader';
import TrendAreaChart from './TrendAreaChart';
import HourlyBarChart from './HourlyBarChart';

function DashboardCharts({ charts }) {
  const primaryChart = charts.primary;
  const secondaryChart = charts.secondary;

  return (
    <section className="dashboard-section">
      <DashboardSectionHeader title="Leitura de Performance" />

      <div className="dashboard-chart-grid">
        <SurfaceCard title={primaryChart.title}>
          <div className="dashboard-chart-card">
            <p className="dashboard-chart-card__description">{primaryChart.description}</p>
            {primaryChart.kind === 'trend' ? <TrendAreaChart data={primaryChart.data} /> : <HourlyBarChart data={primaryChart.data} />}
          </div>
        </SurfaceCard>

        <SurfaceCard title={secondaryChart.title}>
          <div className="dashboard-chart-card">
            <p className="dashboard-chart-card__description">{secondaryChart.description}</p>
            {secondaryChart.kind === 'bar' ? <HourlyBarChart data={secondaryChart.data} /> : <TrendAreaChart data={secondaryChart.data} />}
          </div>
        </SurfaceCard>
      </div>
    </section>
  );
}

export default DashboardCharts;
