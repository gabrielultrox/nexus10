import { useEffect, useRef, useState } from 'react';

import { getFinanceEntryBadge, getFinanceEntryDirection, isFinanceEntryActive } from '../../../services/finance';

function FinanceMovementsTable({ rows }) {
  const [freshRowIds, setFreshRowIds] = useState(() => new Set());
  const previousRowIdsRef = useRef([]);
  const freshTimeoutsRef = useRef(new Map());

  useEffect(() => {
    const freshTimeouts = freshTimeoutsRef.current;

    return () => {
      freshTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      freshTimeouts.clear();
    };
  }, []);

  useEffect(() => {
    const previousIds = previousRowIdsRef.current;
    const nextIds = rows.map((row) => row.id);
    const nextIdSet = new Set(nextIds);
    const freshIds = nextIds.filter((id) => !previousIds.includes(id));

    if (freshIds.length > 0) {
      setFreshRowIds((current) => {
        const next = new Set(current);
        freshIds.forEach((id) => next.add(id));
        return next;
      });

      freshIds.forEach((id) => {
        const existingTimeout = freshTimeoutsRef.current.get(id);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        const timeoutId = setTimeout(() => {
          setFreshRowIds((current) => {
            if (!current.has(id)) {
              return current;
            }

            const next = new Set(current);
            next.delete(id);
            return next;
          });
          freshTimeoutsRef.current.delete(id);
        }, 600);

        freshTimeoutsRef.current.set(id, timeoutId);
      });
    }

    setFreshRowIds((current) => {
      const next = new Set();
      current.forEach((id) => {
        if (nextIdSet.has(id)) {
          next.add(id);
        }
      });
      return next.size === current.size ? current : next;
    });

    previousRowIdsRef.current = nextIds;
  }, [rows]);

  return (
    <div className="finance-table-wrap">
      <table className="ui-table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Origem</th>
            <th>Descricao</th>
            <th>Referencia</th>
            <th>Valor</th>
            <th>Status</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id}
              className={freshRowIds.has(row.id) ? 'ui-table__row-fresh' : 'ui-table__row-enter'}
              style={{ '--row-delay': `${Math.min(index * 40, 240)}ms` }}
            >
              <td>
                <span className={`ui-badge ${getFinanceEntryBadge(row).badgeClass}`}>
                  {getFinanceEntryBadge(row).label}
                </span>
              </td>
              <td className="ui-table__cell--strong">{row.source}</td>
              <td>{row.description}</td>
              <td className="ui-table__cell--muted">{row.relatedSaleId || row.cashierName || '-'}</td>
              <td
                className={`ui-table__cell--numeric ${getFinanceEntryDirection(row) === 'entrada' ? 'finance-value--income' : 'finance-value--expense'}`}
              >
                {row.amount}
              </td>
              <td><span className={`ui-badge ${isFinanceEntryActive(row) ? 'ui-badge--success' : 'ui-badge--warning'}`}>{isFinanceEntryActive(row) ? 'Ativa' : row.status}</span></td>
              <td className="ui-table__cell--mono">{row.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default FinanceMovementsTable;
