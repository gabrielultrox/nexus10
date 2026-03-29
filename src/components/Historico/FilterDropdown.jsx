import { useMemo, useState } from 'react'

import { Button, Select } from '../ui'

function FilterDropdown({ activeChips, onAddChip }) {
  const [selectedChip, setSelectedChip] = useState('operator')

  const availableOptions = useMemo(
    () =>
      [
        { value: 'dateRange', label: 'Data' },
        { value: 'module', label: 'Modulo' },
        { value: 'status', label: 'Status' },
        { value: 'operator', label: 'Operador' },
        { value: 'value', label: 'Valor' },
      ].filter((option) => !activeChips.includes(option.value)),
    [activeChips],
  )

  if (availableOptions.length === 0) {
    return null
  }

  const resolvedValue = availableOptions.some((option) => option.value === selectedChip)
    ? selectedChip
    : availableOptions[0].value

  return (
    <div className="history-filter-dropdown">
      <span className="history-filter-dropdown__label">Adicionar filtro</span>
      <Select
        value={resolvedValue}
        onChange={(event) => setSelectedChip(event.target.value)}
        className="history-filter-dropdown__select"
      >
        {availableOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Button type="button" variant="ghost" onClick={() => onAddChip(resolvedValue)}>
        Adicionar
      </Button>
    </div>
  )
}

export default FilterDropdown
