function normalizeVariant(status = '') {
  const normalized = String(status).trim().toLowerCase()

  if (['pendente', 'aberto', 'fila'].includes(normalized)) {
    return 'warning'
  }

  if (['lançada', 'lancada', 'ok', 'confirmado'].includes(normalized)) {
    return 'success'
  }

  if (['atrasado', 'alerta', 'crítico', 'critico'].includes(normalized)) {
    return 'danger'
  }

  if (['enviado', 'turbo'].includes(normalized)) {
    return 'info'
  }

  return 'neutral'
}

function StatusBadge({ status = '', size = 'md', className = '' }) {
  const variant = normalizeVariant(status)
  const composedClassName = [
    'status-badge',
    `status-badge--${variant}`,
    `status-badge--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <span className={composedClassName}>{status}</span>
}

export default StatusBadge
