import Select from '../../../components/ui/Select'
import { courierShiftOptions, courierStatusOptions } from '../schemas/courierSchema'

function CouriersFilters({ filters, onChange }) {
  function updateFilter(field, value) {
    onChange((current) => ({
      ...current,
      [field]: value,
    }))
  }

  return (
    <div className="couriers-filters">
      <div className="ui-field">
        <label className="ui-label" htmlFor="courier-search">
          Buscar
        </label>
        <input
          id="courier-search"
          className="ui-input"
          type="text"
          value={filters.search}
          placeholder="Nome, telefone, veiculo ou maquininha"
          onChange={(event) => updateFilter('search', event.target.value)}
        />
      </div>

      <div className="ui-field">
        <label className="ui-label" htmlFor="courier-status">
          Status
        </label>
        <Select
          id="courier-status"
          className="ui-select"
          value={filters.status}
          onChange={(event) => updateFilter('status', event.target.value)}
        >
          {courierStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="ui-field">
        <label className="ui-label" htmlFor="courier-shift">
          Turno
        </label>
        <Select
          id="courier-shift"
          className="ui-select"
          value={filters.shift}
          onChange={(event) => updateFilter('shift', event.target.value)}
        >
          {courierShiftOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <label className="couriers-filters__checkbox">
        <input
          type="checkbox"
          checked={filters.fixedOnly}
          onChange={(event) => updateFilter('fixedOnly', event.target.checked)}
        />
        <span>Somente fixos</span>
      </label>
    </div>
  )
}

export default CouriersFilters
