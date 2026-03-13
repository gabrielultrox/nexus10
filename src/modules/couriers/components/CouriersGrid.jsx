import CourierCard from './CourierCard';

function CouriersGrid({ couriers, onDelete }) {
  if (couriers.length === 0) {
    return (
      <div className="module-empty-state">
        <p className="module-empty-state__text">Nenhum entregador encontrado</p>
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
