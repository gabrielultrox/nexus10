import { orderOriginOptions, orderStatusOptions } from '../schemas/orderSchema';

function OrdersFilters({ filters, onChange }) {
  function updateFilter(field, value) {
    onChange((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <div className="orders-filters">
      <div className="ui-field">
        <label className="ui-label" htmlFor="order-search">
          Busca
        </label>
        <input
          id="order-search"
          className="ui-input"
          type="text"
          value={filters.search}
          placeholder="Pedido, cliente, bairro, item ou entregador"
          onChange={(event) => updateFilter('search', event.target.value)}
        />
      </div>

      <div className="ui-field">
        <label className="ui-label" htmlFor="order-status">
          Status
        </label>
        <select
          id="order-status"
          className="ui-select"
          value={filters.status}
          onChange={(event) => updateFilter('status', event.target.value)}
        >
          {orderStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="ui-field">
        <label className="ui-label" htmlFor="order-origin">
          Origem
        </label>
        <select
          id="order-origin"
          className="ui-select"
          value={filters.origin}
          onChange={(event) => updateFilter('origin', event.target.value)}
        >
          {orderOriginOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <label className="orders-filters__checkbox">
        <input
          type="checkbox"
          checked={filters.highPriorityOnly}
          onChange={(event) => updateFilter('highPriorityOnly', event.target.checked)}
        />
        <span>Somente urgentes</span>
      </label>
    </div>
  );
}

export default OrdersFilters;
