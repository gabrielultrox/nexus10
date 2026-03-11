import { getFinanceEntryBadge, getFinanceEntryDirection, isFinanceEntryActive } from '../../../services/finance';

function FinanceMovementsTable({ rows }) {
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
          {rows.map((row) => (
            <tr key={row.id}>
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
              <td>{isFinanceEntryActive(row) ? 'Ativa' : row.status}</td>
              <td className="ui-table__cell--mono">{row.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default FinanceMovementsTable;
