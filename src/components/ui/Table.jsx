import { useMemo, useState } from 'react'

import Button from './Button'

function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }

  return String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR', {
    numeric: true,
    sensitivity: 'base',
  })
}

function Table({
  columns,
  data,
  pageSize = 10,
  emptyMessage = 'Nenhum registro encontrado.',
  defaultSort = null,
}) {
  const [sortState, setSortState] = useState(defaultSort)
  const [page, setPage] = useState(1)

  const sortedData = useMemo(() => {
    if (!sortState?.key) {
      return data
    }

    return [...data].sort((left, right) => {
      const leftValue = left?.[sortState.key]
      const rightValue = right?.[sortState.key]
      const comparison = compareValues(leftValue, rightValue)
      return sortState.direction === 'asc' ? comparison : comparison * -1
    })
  }, [data, sortState])

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedData = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [pageSize, safePage, sortedData])

  function toggleSort(column) {
    if (!column.sortable) {
      return
    }

    setPage(1)
    setSortState((current) => {
      if (current?.key !== column.key) {
        return { key: column.key, direction: 'asc' }
      }

      if (current.direction === 'asc') {
        return { key: column.key, direction: 'desc' }
      }

      return null
    })
  }

  return (
    <div className="ui-table-shell">
      <div className="ui-table-shell__scroller">
        <table className="ui-table">
          <thead>
            <tr>
              {columns.map((column) => {
                const isSorted = sortState?.key === column.key

                return (
                  <th
                    key={column.key}
                    style={column.width ? { width: column.width } : undefined}
                    aria-sort={
                      isSorted
                        ? sortState.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        className={`ui-table__sort${isSorted ? ' is-active' : ''}`}
                        onClick={() => toggleSort(column)}
                      >
                        <span>{column.label}</span>
                        <span className="ui-table__sort-icon" aria-hidden="true">
                          {isSorted ? (sortState.direction === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {pagedData.length ? (
              pagedData.map((row, rowIndex) => (
                <tr key={row.id ?? rowIndex}>
                  {columns.map((column) => (
                    <td key={column.key}>
                      {typeof column.render === 'function' ? column.render(row) : row?.[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>
                  <div className="empty-state">
                    <span className="empty-state__message">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="ui-table__pagination">
        <p className="ui-table__pagination-meta">
          Pagina {safePage} de {totalPages}
        </p>
        <div className="ui-table__pagination-actions">
          <Button
            variant="ghost"
            disabled={safePage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Anterior
          </Button>
          <Button
            variant="ghost"
            disabled={safePage >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            Proxima
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Table
