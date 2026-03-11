import { Link } from 'react-router-dom';

import { courierShiftMap, courierStatusMap } from '../schemas/courierSchema';

function CourierProfilePanel({ courier }) {
  const status = courierStatusMap[courier.status];

  return (
    <section className="courier-profile-layout">
      <article className="ui-card courier-profile-hero">
        <div className="courier-profile-hero__header">
          <div>
            <p className="text-overline">Operational Identity</p>
            <h2 className="courier-profile-hero__title">{courier.name}</h2>
            <p className="text-body">
              {courier.vehicle} - {courier.machine}
            </p>
          </div>

          <div className="courier-profile-hero__badges">
            <span className={`ui-badge ${status.badgeClass}`}>{status.label}</span>
            <span className="ui-badge ui-badge--info">{courierShiftMap[courier.shift]}</span>
            {courier.isFixed ? <span className="ui-badge ui-badge--warning">Fixo</span> : null}
          </div>
        </div>

        <div className="courier-profile-hero__metrics">
          <div className="courier-profile-hero__metric">
            <span className="courier-card__metric-label">Entregas hoje</span>
            <strong>{courier.deliveriesToday}</strong>
          </div>
          <div className="courier-profile-hero__metric">
            <span className="courier-card__metric-label">Entregas semana</span>
            <strong>{courier.weeklyDeliveries}</strong>
          </div>
          <div className="courier-profile-hero__metric">
            <span className="courier-card__metric-label">Avaliacao</span>
            <strong>{courier.rating.toFixed(1)}</strong>
          </div>
        </div>

        <div className="courier-profile-hero__actions">
          <Link to={`/couriers/cadastro?edit=${courier.id}`} className="ui-button ui-button--secondary">
            Editar cadastro
          </Link>
          <button type="button" className="ui-button ui-button--ghost">
            Acionar escala
          </button>
          <button type="button" className="ui-button ui-button--ghost">
            Nova observacao
          </button>
        </div>
      </article>

      <div className="courier-profile-layout__secondary">
        <article className="ui-card courier-profile-panel">
          <div className="courier-profile-panel__inner">
            <p className="text-overline">Contato</p>
            <div className="courier-profile-info">
              <div>
                <span className="courier-card__metric-label">Telefone</span>
                <strong>{courier.phone}</strong>
              </div>
              <div>
                <span className="courier-card__metric-label">Turno</span>
                <strong>{courierShiftMap[courier.shift]}</strong>
              </div>
            </div>
          </div>
        </article>

        <article className="ui-card courier-profile-panel">
          <div className="courier-profile-panel__inner">
            <p className="text-overline">Observacoes</p>
            <p className="text-body">{courier.notes}</p>
          </div>
        </article>
      </div>

      <article className="ui-card courier-profile-panel">
        <div className="courier-profile-panel__inner">
          <p className="text-overline">Timeline do turno</p>
          <div className="courier-timeline">
            {courier.timeline.map((item) => (
              <div key={item.id} className="courier-timeline__item">
                <span className="courier-timeline__time">{item.time}</span>
                <div>
                  <strong>{item.label}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}

export default CourierProfilePanel;
