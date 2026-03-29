import { Input, Select } from '../ui'

function FilterChipFrame({ icon, label, children, onRemove }) {
  return (
    <div className="history-filter-chip">
      <span className="history-filter-chip__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="history-filter-chip__label">{label}</span>
      <div className="history-filter-chip__control">{children}</div>
      <button
        type="button"
        className="history-filter-chip__remove"
        aria-label={`Remover filtro ${label}`}
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  )
}

function FilterChips({
  filters,
  moduleOptions,
  statusOptions,
  activeChips,
  onRemoveChip,
  onSetFilterValue,
}) {
  return (
    <div className="history-filter-chips" aria-label="Filtros ativos">
      {activeChips.includes('dateRange') ? (
        <FilterChipFrame
          icon="📅"
          label={`Data: ${filters.dateRange.start} - ${filters.dateRange.end}`}
          onRemove={() => onRemoveChip('dateRange')}
        >
          <div className="history-filter-chip__date-range">
            <Input
              type="date"
              value={filters.dateRange.start}
              onChange={(event) =>
                onSetFilterValue('dateRange', {
                  start: event.target.value,
                  end: filters.dateRange.end,
                })
              }
            />
            <Input
              type="date"
              value={filters.dateRange.end}
              onChange={(event) =>
                onSetFilterValue('dateRange', {
                  start: filters.dateRange.start,
                  end: event.target.value,
                })
              }
            />
          </div>
        </FilterChipFrame>
      ) : null}

      {activeChips.includes('module') ? (
        <FilterChipFrame
          icon="🏷"
          label={`Modulo: ${moduleOptions.find((option) => option.value === filters.module)?.label ?? 'Todos'}`}
          onRemove={() => onRemoveChip('module')}
        >
          <Select
            value={filters.module}
            onChange={(event) => onSetFilterValue('module', event.target.value)}
          >
            {moduleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FilterChipFrame>
      ) : null}

      {activeChips.includes('status') ? (
        <FilterChipFrame
          icon="●"
          label={`Status: ${statusOptions.find((option) => option.value === filters.status)?.label ?? 'Tudo'}`}
          onRemove={() => onRemoveChip('status')}
        >
          <Select
            value={filters.status}
            onChange={(event) => onSetFilterValue('status', event.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FilterChipFrame>
      ) : null}

      {activeChips.includes('operator') ? (
        <FilterChipFrame
          icon="👤"
          label={`Operador: ${filters.operator || 'Qualquer'}`}
          onRemove={() => onRemoveChip('operator')}
        >
          <Input
            type="text"
            value={filters.operator}
            placeholder="Nome do operador"
            onChange={(event) => onSetFilterValue('operator', event.target.value)}
          />
        </FilterChipFrame>
      ) : null}

      {activeChips.includes('value') ? (
        <FilterChipFrame
          icon="R$"
          label={`Valor: ${filters.value || 'Qualquer'}`}
          onRemove={() => onRemoveChip('value')}
        >
          <Input
            type="text"
            value={filters.value}
            placeholder="R$ 10,00"
            onChange={(event) => onSetFilterValue('value', event.target.value)}
          />
        </FilterChipFrame>
      ) : null}
    </div>
  )
}

export default FilterChips
