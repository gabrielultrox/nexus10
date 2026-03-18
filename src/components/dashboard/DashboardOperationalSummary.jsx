import SurfaceCard from '../common/SurfaceCard';
import DashboardSectionHeader from './DashboardSectionHeader';

function DashboardOperationalSummary({ operations }) {
  return (
    <section className="dashboard-section">
      <DashboardSectionHeader title="Operacao do turno" />

      <div className="dashboard-summary-grid">
        <SurfaceCard title="Escala Ativa">
          {operations.activeShift.length === 0 ? (
            <div className="ops-empty ops-empty--shift">Nenhum entregador ativo</div>
          ) : (
            <div className="ops-list ops-list--shift">
              {operations.activeShift.map((item) => (
                <div key={item.id} className="ops-row ops-row--simple">
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
            <div className="ops-empty ops-empty--compact">Sem produtos em destaque</div>
          ) : (
            <div className="ops-list ops-list--compact">
              {operations.topProducts.map((item) => (
                <div key={item.id} className="ops-row ops-row--inline">
                  <div className="ops-row__main">
                    <strong className="ops-row__title ops-row__title--small">{item.title}</strong>
                    <span className={`ui-badge ${item.badgeClass}`}>{item.badgeText}</span>
                  </div>
                  <span className="ops-row__value">{item.description}</span>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard title="Estoque Baixo">
          {operations.lowStock.length === 0 ? (
            <div className="ops-empty ops-empty--compact">Nenhum produto no limite minimo</div>
          ) : (
            <div className="ops-list ops-list--compact">
              {operations.lowStock.map((item) => (
                <div key={item.id} className="ops-row ops-row--inline ops-row--low-stock">
                  <div className="ops-row__main ops-row__main--danger">
                    <span className="ops-row__dot" aria-hidden="true" />
                    <strong className="ops-row__title ops-row__title--small">{item.title}</strong>
                  </div>
                  <span className="ops-row__value ops-row__value--danger">{item.description}</span>
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
