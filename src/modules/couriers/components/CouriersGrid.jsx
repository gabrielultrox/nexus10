import CourierCard from './CourierCard';

function CouriersGrid({ couriers, onDelete }) {
  if (couriers.length === 0) {
    return (
      <div className="surface-card courier-empty-state">
        <div className="surface-card__content">
          <p className="text-overline">No Results</p>
          <h2 className="text-section-title">Nenhum entregador encontrado</h2>
          <p className="text-body">
            Ajuste os filtros para ampliar a busca dentro da base operacional atual.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="couriers-grid">
      {couriers.map((courier) => (
        <CourierCard key={courier.id} courier={courier} onDelete={onDelete} />
      ))}
    </div>
  );
}

export default CouriersGrid;
