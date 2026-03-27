import { useEffect, useMemo, useState } from 'react'

import Button from './Button'
import Skeleton from './Skeleton'
import type { ITableColumn, ITableProps, ITableSortState } from './types'

function compareValues(a: unknown, b: unknown) {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }

  return String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR', {
    numeric: true,
    sensitivity: 'base',
  })
}

function Table<TData extends Record<string, unknown>>({
  columns,
  data,
  pageSize = 10,
  emptyMessage = 'Nenhum registro encontrado.',
  caption,
  defaultSort = null,
  getRowKey,
  isLoading = false,
  loadingRowCount = 5,
}: ITableProps<TData>) {
  const [sortState, setSortState] = useState<ITableSortState<TData> | null>(defaultSort)
  const [page, setPage] = useState(1)
  const [pageMotionDirection, setPageMotionDirection] = useState<'forward' | 'backward' | null>(
    null,
  )

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

  useEffect(() => {
    if (!pageMotionDirection) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setPageMotionDirection(null)
    }, 220)

    return () => window.clearTimeout(timeoutId)
  }, [pageMotionDirection])

  function toggleSort(column: ITableColumn<TData>) {
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
          {caption ? <caption className="ui-sr-only">{caption}</caption> : null}
          <thead>
            <tr>
              {columns.map((column) => {
                const isSorted = sortState?.key === column.key

                return (
                  <th
                    key={column.key}
                    scope="col"
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
                        aria-label={
                          column.headerAriaLabel ??
                          `Ordenar por ${String(column.label)}${isSorted ? `, ${sortState.direction}` : ''}`
                        }
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
          <tbody
            className={[
              'ui-table__page-transition',
              pageMotionDirection ? `ui-table__page-transition--${pageMotionDirection}` : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {isLoading ? (
              Array.from({ length: loadingRowCount }).map((_, rowIndex) => (
                <tr key={`loading-row-${rowIndex}`}>
                  {columns.map((column, columnIndex) => (
                    <td key={`${String(column.key)}-${columnIndex}`}>
                      <Skeleton
                        variant="line"
                        width={columnIndex === 0 ? '70%' : '100%'}
                        height="14px"
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : pagedData.length ? (
              pagedData.map((row, rowIndex) => (
                <tr key={getRowKey ? getRowKey(row, rowIndex) : String(row.id ?? rowIndex)}>
                  {columns.map((column) => (
                    <td key={column.key}>
                      {typeof column.render === 'function'
                        ? column.render(row)
                        : String(row?.[column.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>
                  <div className="empty-state" role="status" aria-live="polite">
                    <span className="empty-state__message">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <nav className="ui-table__pagination" aria-label="Paginacao da tabela">
        <p className="ui-table__pagination-meta">
          Pagina {safePage} de {totalPages}
        </p>
        <div className="ui-table__pagination-actions">
          <Button
            variant="ghost"
            disabled={safePage <= 1}
            onClick={() => {
              setPageMotionDirection('backward')
              setPage((value) => Math.max(1, value - 1))
            }}
            aria-label="Ir para a pagina anterior"
          >
            Anterior
          </Button>
          <Button
            variant="ghost"
            disabled={safePage >= totalPages}
            onClick={() => {
              setPageMotionDirection('forward')
              setPage((value) => Math.min(totalPages, value + 1))
            }}
            aria-label="Ir para a proxima pagina"
          >
            Proxima
          </Button>
        </div>
      </nav>
    </div>
  )
}

export default Table
