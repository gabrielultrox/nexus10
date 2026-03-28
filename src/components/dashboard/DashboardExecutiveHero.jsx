import Button from '../ui/Button'

function DashboardExecutiveHero({ hero, onNavigate }) {
  if (!hero) {
    return null
  }

  return (
    <section className="dashboard-hero surface-card" aria-label="Resumo executivo do turno">
      <div className="dashboard-hero__head">
        <div className="dashboard-hero__copy">
          <p className="dashboard-hero__eyebrow">{hero.eyebrow}</p>
          <h2 className="dashboard-hero__title">{hero.title}</h2>
          <p className="dashboard-hero__description">{hero.description}</p>
        </div>

        <span className={`dashboard-hero__status dashboard-hero__status--${hero.statusTone}`}>
          {hero.statusLabel}
        </span>
      </div>

      <div className="dashboard-hero__signals">
        {hero.signals.map((signal) => (
          <article key={signal.id} className="dashboard-hero__signal">
            <span className="dashboard-hero__signal-label">{signal.label}</span>
            <strong className="dashboard-hero__signal-value">{signal.value}</strong>
            <span className="dashboard-hero__signal-meta">{signal.meta}</span>
          </article>
        ))}
      </div>

      <div className="dashboard-hero__actions">
        {hero.actions.map((action) => (
          <Button
            key={action.id}
            variant={action.variant ?? 'secondary'}
            onClick={() => onNavigate?.(action.route)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </section>
  )
}

export default DashboardExecutiveHero
