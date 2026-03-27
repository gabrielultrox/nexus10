import { useEffect, useMemo, useState } from 'react';

import MetricCard from '../../../components/common/MetricCard';
import SurfaceCard from '../../../components/common/SurfaceCard';
import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';
import {
  buildAuditLogsCsv,
  listAdminAuditLogs,
  listAllAdminAuditLogs,
} from '../../../services/adminAuditLogs';

const INITIAL_FILTERS = {
  date: '',
  actor: '',
  action: '',
  resource: '',
};

function formatDateTime(value) {
  if (!value) {
    return '--';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function downloadCsvFile(content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);

  anchor.href = url;
  anchor.download = `audit-logs-${stamp}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function AuditLogModule() {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadAuditLogs() {
      setLoading(true);
      setErrorMessage('');

      try {
        const response = await listAdminAuditLogs({
          ...filters,
          page,
          limit: pagination.limit,
        });

        if (!isMounted) {
          return;
        }

        setLogs(response.items ?? []);
        setPagination(response.pagination ?? {
          page,
          limit: pagination.limit,
          total: 0,
          pages: 0,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLogs([]);
        setErrorMessage(error.message ?? 'Nao foi possivel carregar os logs de auditoria.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAuditLogs();

    return () => {
      isMounted = false;
    };
  }, [filters, page, pagination.limit]);

  const metrics = useMemo(() => {
    const uniqueActors = new Set(logs.map((log) => log.actorName).filter(Boolean));
    const uniqueResources = new Set(logs.map((log) => log.resource).filter(Boolean));

    return [
      {
        label: 'Total filtrado',
        value: String(pagination.total).padStart(2, '0'),
        meta: 'registros encontrados com os filtros atuais',
        badgeText: 'logs',
        badgeClass: 'ui-badge--info',
      },
      {
        label: 'Pagina atual',
        value: `${pagination.page}`,
        meta: `${logs.length} itens carregados nesta pagina`,
        badgeText: 'pagina',
        badgeClass: 'ui-badge--special',
      },
      {
        label: 'Atores',
        value: String(uniqueActors.size).padStart(2, '0'),
        meta: 'atores visiveis na pagina atual',
        badgeText: 'atores',
        badgeClass: 'ui-badge--success',
      },
      {
        label: 'Recursos',
        value: String(uniqueResources.size).padStart(2, '0'),
        meta: 'tipos de recurso visiveis na pagina atual',
        badgeText: 'escopo',
        badgeClass: 'ui-badge--warning',
      },
    ];
  }, [logs, pagination.page, pagination.total]);

  function updateFilter(key, value) {
    setPage(1);
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleExportCsv() {
    setExporting(true);

    try {
      const exportItems = await listAllAdminAuditLogs(filters);
      const csvContent = buildAuditLogsCsv(exportItems);
      downloadCsvFile(csvContent);
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel exportar os logs.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="entity-module audit-log-module">
      <div className="card-grid">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            meta={metric.meta}
            badgeText={metric.badgeText}
            badgeClass={metric.badgeClass}
          />
        ))}
      </div>

      <SurfaceCard title="Filtros de auditoria">
        <div className="entity-toolbar audit-log-toolbar audit-log-toolbar--filters">
          <div className="ui-field">
            <label className="ui-label" htmlFor="audit-log-date">Data</label>
            <input
              id="audit-log-date"
              className="ui-input"
              type="date"
              value={filters.date}
              onChange={(event) => updateFilter('date', event.target.value)}
            />
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor="audit-log-actor">Ator</label>
            <input
              id="audit-log-actor"
              className="ui-input"
              value={filters.actor}
              onChange={(event) => updateFilter('actor', event.target.value)}
              placeholder="Gabriel, local-gabriel..."
            />
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor="audit-log-action">Acao</label>
            <input
              id="audit-log-action"
              className="ui-input"
              value={filters.action}
              onChange={(event) => updateFilter('action', event.target.value)}
              placeholder="CREATE, UPDATE, DELETE..."
            />
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor="audit-log-resource">Recurso</label>
            <input
              id="audit-log-resource"
              className="ui-input"
              value={filters.resource}
              onChange={(event) => updateFilter('resource', event.target.value)}
              placeholder="orders, sales, trocos..."
            />
          </div>
        </div>

        <div className="audit-log-toolbar-actions">
          <Button type="button" variant="secondary" onClick={() => {
            setFilters({ ...INITIAL_FILTERS });
            setPage(1);
          }}>
            Limpar filtros
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={handleExportCsv}
            disabled={exporting || loading}
          >
            {exporting ? 'Exportando CSV...' : 'Exportar CSV'}
          </Button>
        </div>
      </SurfaceCard>

      {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

      <SurfaceCard title="Tabela de auditoria">
        {loading ? (
          <EmptyState message="Carregando logs de auditoria..." />
        ) : logs.length === 0 ? (
          <EmptyState message="Nenhum log encontrado com os filtros atuais" />
        ) : (
          <>
            <div className="entity-table-wrap entity-table-wrap--dense">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Ator</th>
                    <th>Acao</th>
                    <th>Recurso</th>
                    <th>Registro</th>
                    <th>Loja</th>
                    <th>Descricao</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="ui-table__cell--mono">{formatDateTime(log.createdAt)}</td>
                      <td className="ui-table__cell--strong">{log.actorName || 'Sistema'}</td>
                      <td>{log.action || '--'}</td>
                      <td>{log.resource || '--'}</td>
                      <td className="ui-table__cell--mono">{log.resourceId || '--'}</td>
                      <td className="ui-table__cell--mono">{log.storeId || '--'}</td>
                      <td className="audit-log-table__description">{log.description || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="audit-log-pagination">
              <p className="audit-log-pagination__summary">
                Pagina {pagination.page} de {Math.max(pagination.pages, 1)} · {pagination.total} registros
              </p>

              <div className="audit-log-pagination__actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                  disabled={pagination.page <= 1}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={pagination.pages === 0 || pagination.page >= pagination.pages}
                >
                  Proxima
                </Button>
              </div>
            </div>
          </>
        )}
      </SurfaceCard>
    </section>
  );
}

export default AuditLogModule;


