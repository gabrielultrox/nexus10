import { useMemo, useState } from 'react'

import { Button, Table } from '../../components/ui'

function formatDateTime(value, timezone) {
  if (!value) {
    return '--'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: timezone || undefined,
  }).format(new Date(value))
}

function AuditDetails({ item }) {
  const beforeText = useMemo(() => JSON.stringify(item.before ?? null, null, 2), [item.before])
  const afterText = useMemo(() => JSON.stringify(item.after ?? null, null, 2), [item.after])

  return (
    <div className="audit-grid__details">
      <div className="audit-grid__detail-card">
        <h4>Contexto</h4>
        <dl className="audit-grid__detail-list">
          <div>
            <dt>Modulo</dt>
            <dd>{item.module || '--'}</dd>
          </div>
          <div>
            <dt>Entidade</dt>
            <dd>{item.entityType || '--'}</dd>
          </div>
          <div>
            <dt>Registro</dt>
            <dd>{item.entityId || '--'}</dd>
          </div>
          <div>
            <dt>Motivo</dt>
            <dd>{item.reason || '--'}</dd>
          </div>
          <div>
            <dt>IP</dt>
            <dd>{item.ip || '--'}</dd>
          </div>
          <div>
            <dt>Request ID</dt>
            <dd>{item.requestId || '--'}</dd>
          </div>
        </dl>
      </div>

      <div className="audit-grid__detail-card">
        <h4>Before</h4>
        <pre>{beforeText}</pre>
      </div>

      <div className="audit-grid__detail-card">
        <h4>After</h4>
        <pre>{afterText}</pre>
      </div>
    </div>
  )
}

function AuditGrid({ items, loading, emptyMessage = 'Nenhum log encontrado' }) {
  const [expandedId, setExpandedId] = useState('')

  const rows = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        rowId: item.id,
        createdAtLabel: formatDateTime(item.timestampUtc || item.createdAt, item.timezone),
        actorLabel: item.actorName || item.userId || 'Sistema',
        actionLabel: item.action || '--',
        moduleLabel: item.module || '--',
        entityLabel: item.entityType || '--',
        entityIdLabel: item.entityId || '--',
        statusLabel: item.statusCode ? `${item.statusCode}` : '--',
      })),
    [items],
  )

  const columns = useMemo(
    () => [
      { key: 'createdAtLabel', label: 'Data' },
      { key: 'actorLabel', label: 'Usuario' },
      { key: 'actionLabel', label: 'Acao' },
      { key: 'moduleLabel', label: 'Modulo' },
      { key: 'entityLabel', label: 'Entidade' },
      { key: 'entityIdLabel', label: 'Registro' },
      { key: 'statusLabel', label: 'Status' },
      {
        key: 'details',
        label: 'Detalhes',
        render: (row) => (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setExpandedId((current) => (current === row.rowId ? '' : row.rowId))}
            aria-expanded={expandedId === row.rowId}
          >
            {expandedId === row.rowId ? 'Ocultar' : 'Ver'}
          </Button>
        ),
      },
    ],
    [expandedId],
  )

  return (
    <div className="audit-grid">
      <Table
        columns={columns}
        data={rows}
        caption="Tabela de auditoria"
        paginate={false}
        isLoading={loading}
        loadingRowCount={8}
        emptyMessage={emptyMessage}
        getRowKey={(row) => row.rowId}
      />

      {expandedId ? (
        <AuditDetails item={items.find((item) => item.id === expandedId) ?? {}} />
      ) : null}
    </div>
  )
}

export default AuditGrid
