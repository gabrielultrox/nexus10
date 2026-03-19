import CourierCard from './CourierCard';
import EmptyState from '../../../components/ui/EmptyState';

function CouriersGroup({ group, onDelete, onToggleGroup }) {
  return (
    <section className="couriers-group">
      <header className="couriers-group__header">
        <div className="couriers-group__heading">
          <span className="couriers-group__title">{group.title}</span>
          <span className={`couriers-group__count couriers-group__count--${group.tone}`}>{group.couriers.length}</span>
        </div>
        {group.collapsible ? (
          <button
            type="button"
            className="couriers-group__toggle"
            aria-expanded={!group.collapsed}
            onClick={() => onToggleGroup?.(group.id)}
          >
            {group.collapsed ? 'Mostrar' : 'Ocultar'}
          </button>
        ) : null}
      </header>

      {!group.collapsed ? (
        <div className="couriers-grid">
          {group.couriers.map((courier) => (
            <CourierCard
              key={courier.id}
              courier={courier}
              onDelete={onDelete}
              showActivityIndicator={group.id === 'active'}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CouriersGrid({ couriers, groups, onDelete, onToggleGroup }) {
  const visibleGroups = groups?.filter((group) => group.couriers.length > 0) ?? [];

  if ((groups && visibleGroups.length === 0) || (!groups && couriers.length === 0)) {
    return (
      <EmptyState message="Nenhum entregador encontrado" />
    );
  }

  if (visibleGroups.length > 0) {
    return (
      <div className="couriers-groups">
        {visibleGroups.map((group) => (
          <CouriersGroup
            key={group.id}
            group={group}
            onDelete={onDelete}
            onToggleGroup={onToggleGroup}
          />
        ))}
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

