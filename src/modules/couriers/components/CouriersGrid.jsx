import CourierCard from './CourierCard';
import EmptyState from '../../../components/ui/EmptyState';

function CouriersGrid({ couriers, onDelete }) {
  if (couriers.length === 0) {
    return (
      <EmptyState message="Nenhum entregador encontrado" />
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

