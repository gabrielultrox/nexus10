import { Link } from 'react-router-dom';

import { courierShiftMap, courierStatusMap } from '../schemas/courierSchema';

function CourierCard({ courier, onDelete }) {
  const status = courierStatusMap[courier.status];
  const initial = courier.name?.trim()?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <article className="ui-card ui-card--interactive courier-card">
      <div className="courier-card__header">
        <div className="courier-card__identity">
          <div className="courier-card__avatar">{initial}</div>
          <div>
            <p className="text-overline">Entregador</p>
            <h2 className="courier-card__title">{courier.name}</h2>
            <p className="courier-card__meta">{courier.vehicle}</p>
          </div>
        </div>

        <div className="courier-card__top-actions">
          <div className="courier-card__badges">
            <span className={`ui-badge ${status.badgeClass}`}>{status.label}</span>
            {courier.isFixed ? <span className="ui-badge ui-badge--warning">Fixo</span> : null}
          </div>
          <span className="courier-card__machine-chip">{courier.machine}</span>
        </div>
      </div>

      <div className="courier-card__body">
        <div className="courier-card__status-line">
          <span>{courier.phone}</span>
          <span>{courierShiftMap[courier.shift]}</span>
          <span>{courier.deliveriesToday} entregas</span>
        </div>

        <div className="courier-card__metrics">
          <div className="courier-card__metric">
            <span className="courier-card__metric-label">Hoje</span>
            <strong>{courier.deliveriesToday}</strong>
          </div>
          <div className="courier-card__metric">
            <span className="courier-card__metric-label">Semana</span>
            <strong>{courier.weeklyDeliveries}</strong>
          </div>
          <div className="courier-card__metric">
            <span className="courier-card__metric-label">Avaliacao</span>
            <strong>{courier.rating.toFixed(1)}</strong>
          </div>
        </div>

        <p className="courier-card__notes">{courier.notes}</p>
      </div>

      <div className="courier-card__actions">
        <Link to={`/couriers/${courier.id}`} className="ui-button ui-button--secondary">
          Ver perfil
        </Link>
        <button
          type="button"
          className="ui-button ui-button--danger"
          onClick={() => onDelete?.(courier.id)}
        >
          Excluir cadastro
        </button>
      </div>
    </article>
  );
}

export default CourierCard;
