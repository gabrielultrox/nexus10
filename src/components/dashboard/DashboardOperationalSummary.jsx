import SurfaceCard from '../common/SurfaceCard';
import DashboardSectionHeader from './DashboardSectionHeader';

function DashboardOperationalSummary({ operations }) {
  return (
    <section className="dashboard-section">
      <DashboardSectionHeader title="Operacao do turno" />

      <div className="dashboard-summary-grid">
        <SurfaceCard title="Escala Ativa">
          {operations.activeShift.length === 0 ? (
            <div className="ops-empty ops-empty--inline">Nenhum entregador ativo</div>
          ) : (
            <div className="ops-list">
              {operations.activeShift.map((item) => (
                <div key={item.id} className="ops-row">
                  <div>
                    <strong className="ops-row__title">{item.name}</strong>
                    <p className="ops-row__meta">
                      {item.role} - {item.machine}
                    </p>
                  </div>
                  <span className={`ui-badge ${item.statusClass}`}>{item.statusLabel}</span>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard title="Top Produtos">
          {operations.topProducts.length === 0 ? (
            <div className="ops-empty">As vendas concluidas alimentam este ranking.</div>
          ) : (
            <div className="ops-list">
              {operations.topProducts.map((item) => (
                <div key={item.id} className="ops-row ops-row--stacked">
                  <div>
                    <strong className="ops-row__title">{item.title}</strong>
                    <p className="ops-row__meta">{item.description}</p>
                  </div>
                  <span className={`ui-badge ${item.badgeClass}`}>{item.badgeText}</span>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard title="Estoque Baixo">
          {operations.lowStock.length === 0 ? (
            <div className="ops-empty">Nenhum produto esta no limite minimo.</div>
          ) : (
            <div className="ops-list">
              {operations.lowStock.map((item) => (
                <div key={item.id} className="ops-row ops-row--stacked">
                  <div>
                    <strong className="ops-row__title">{item.title}</strong>
                    <p className="ops-row__meta">{item.description}</p>
                  </div>
                  <span className={`ui-badge ${item.badgeClass}`}>{item.badgeText}</span>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard title="Financeiro do Periodo">
          <div className="ops-metrics">
            {operations.closing.map((item) => (
              <div key={item.id} className="ops-metric">
                <span className="ops-metric__label">{item.label}</span>
                <strong className="ops-metric__value">{item.value}</strong>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>
    </section>
  );
}

export default DashboardOperationalSummary;
