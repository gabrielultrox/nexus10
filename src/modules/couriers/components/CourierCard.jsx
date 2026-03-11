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
            <h2 className="courier-card__title">{courier.name}</h2>
            <p className="courier-card__meta">{courier.phone}</p>
          </div>
        </div>

        <span className="courier-card__machine-chip">{courier.machine}</span>
      </div>

      <div className="courier-card__badges">
        <span className={`ui-badge ${status.badgeClass}`}>{status.label}</span>
        <span className="ui-badge ui-badge--info">{courierShiftMap[courier.shift]}</span>
        {courier.isFixed ? <span className="ui-badge ui-badge--warning">Fixo</span> : null}
      </div>

      <div className="courier-card__details">
        <div className="courier-card__detail">
          <span>Veiculo</span>
          <strong>{courier.vehicle}</strong>
        </div>
        <div className="courier-card__detail">
          <span>Hoje</span>
          <strong>{courier.deliveriesToday} entregas</strong>
        </div>
        <div className="courier-card__detail">
          <span>Semana</span>
          <strong>{courier.weeklyDeliveries}</strong>
        </div>
        <div className="courier-card__detail">
          <span>Avaliacao</span>
          <strong>{courier.rating.toFixed(1)}</strong>
        </div>
      </div>

      <p className="courier-card__notes">{courier.notes}</p>

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
