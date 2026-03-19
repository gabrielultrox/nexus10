import { Link } from 'react-router-dom';

import { courierShiftMap, courierStatusMap } from '../schemas/courierSchema';

function CourierCard({ courier, onDelete, showActivityIndicator = false }) {
  const status = courierStatusMap[courier.status];
  const initial = courier.name?.trim()?.charAt(0)?.toUpperCase() ?? '?';
  const machineLabel =
    courier.machine && courier.machine !== 'Sem maquininha' ? courier.machine : 'Sem maquininha';

  return (
    <article className={`ui-card ui-card--interactive courier-card${showActivityIndicator ? ' courier-card--active' : ''}`}>
      <div className="courier-card__identity">
        <div className="courier-card__avatar">{initial}</div>
        <div className="courier-card__identity-copy">
          <div className="courier-card__title-row">
            <h2 className="courier-card__title">{courier.name}</h2>
            {showActivityIndicator ? <span className="courier-card__activity-dot" aria-hidden="true" /> : null}
          </div>
          <p className="courier-card__meta">{courier.phone}</p>
        </div>
      </div>

      <div className="courier-card__summary">
        <span className={`ui-badge ${status.badgeClass}`}>{status.label}</span>
        <span className="ui-badge ui-badge--info">{courierShiftMap[courier.shift]}</span>
        {courier.isFixed ? <span className="ui-badge ui-badge--warning">Fixo</span> : null}
        <p className="courier-card__inline-metrics">
          <span>{courier.vehicle}</span>
          <span>{machineLabel}</span>
          <span>{courier.deliveriesToday} hoje</span>
          <span>{courier.weeklyDeliveries} semana</span>
          <span>nota {courier.rating.toFixed(1)}</span>
        </p>
      </div>

      <div className="courier-card__actions">
        <Link to={`/couriers/${courier.id}`} className="ui-button ui-button--ghost courier-card__action">
          Abrir
        </Link>
        <button
          type="button"
          className="courier-card__icon-action"
          onClick={() => onDelete?.(courier.id)}
          aria-label={`Remover ${courier.name}`}
          title="Remover"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 2h4l.5 1H13v1H3V3h2.5L6 2Zm-1 4h1v6H5V6Zm3 0h1v6H8V6Zm3 0h-1v6h1V6Z" />
          </svg>
        </button>
      </div>
    </article>
  );
}

export default CourierCard;
