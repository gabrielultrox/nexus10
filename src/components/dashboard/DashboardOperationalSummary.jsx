import SurfaceCard from '../common/SurfaceCard'
import Button from '../ui/Button'
import DashboardSectionHeader from './DashboardSectionHeader'

function DashboardOperationalSummary({ operations, onNavigate }) {
  return (
    <section className="dashboard-section">
      <DashboardSectionHeader title="Mesa executiva" />

      <div className="dashboard-command-grid">
        {operations.commandCenter.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`dashboard-command-card dashboard-command-card--${item.tone}`}
            onClick={() => item.route && onNavigate?.(item.route)}
          >
            <div className="dashboard-command-card__top">
              <span className="dashboard-command-card__label">{item.label}</span>
              <span className={`ui-badge ${item.badgeClass}`}>{item.badgeText}</span>
            </div>
            <strong className="dashboard-command-card__value">{item.value}</strong>
            <p className="dashboard-command-card__meta">{item.meta}</p>
            <span className="dashboard-command-card__action">{item.actionLabel}</span>
          </button>
        ))}
      </div>

      <div className="dashboard-summary-grid">
        <SurfaceCard title="Riscos do turno">
          {operations.risks.length === 0 ? (
            <div className="ops-empty ops-empty--compact">Nenhum risco prioritario no momento</div>
          ) : (
            <div className="ops-list ops-list--compact">
              {operations.risks.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`ops-row ops-row--risk ops-row--risk-${item.tone}`}
                  onClick={() => item.route && onNavigate?.(item.route)}
                >
                  <div className="ops-row__stack">
                    <strong className="ops-row__title ops-row__title--small">{item.title}</strong>
                    <p className="ops-row__meta">{item.description}</p>
                  </div>
                  <span className={`ui-badge ${item.badgeClass}`}>{item.badgeText}</span>
                </button>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard title="Financeiro e caixa">
          <div className="ops-metrics ops-metrics--grid">
            {operations.financialPulse.map((item) => (
              <div key={item.id} className="ops-metric">
                <span className="ops-metric__label">{item.label}</span>
                <strong className="ops-metric__value">{item.value}</strong>
                <span className="ops-metric__meta">{item.meta}</span>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard title="Monitoramento">
          <div className="ops-list ops-list--compact">
            {operations.integrationWatch.map((item) => (
              <button
                key={item.id}
                type="button"
                className="ops-row ops-row--inline"
                onClick={() => item.route && onNavigate?.(item.route)}
              >
                <div className="ops-row__stack">
                  <strong className="ops-row__title ops-row__title--small">{item.title}</strong>
                  <p className="ops-row__meta">{item.description}</p>
                </div>
                <span className={`ui-badge ${item.badgeClass}`}>{item.badgeText}</span>
              </button>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard title="Entregadores e leitura">
          <div className="ops-metrics ops-metrics--grid">
            {operations.deliveryPulse.map((item) => (
              <div key={item.id} className="ops-metric">
                <span className="ops-metric__label">{item.label}</span>
                <strong className="ops-metric__value">{item.value}</strong>
                <span className="ops-metric__meta">{item.meta}</span>
              </div>
            ))}
          </div>

          {operations.activeShift.length === 0 ? (
            <div className="ops-empty ops-empty--compact">Nenhum entregador ativo</div>
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

        <SurfaceCard title="Top produtos">
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

        <SurfaceCard title="Estoque e abastecimento">
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

          <div className="dashboard-summary-actions">
            <Button variant="secondary" onClick={() => onNavigate?.('/inventory')}>
              Abrir estoque
            </Button>
          </div>
        </SurfaceCard>
      </div>
    </section>
  )
}

export default DashboardOperationalSummary
