import type { ReactNode } from 'react'

import LoadingSpinner from './LoadingSpinner'

export interface ILoadingOverlayProps {
  active?: boolean
  className?: string
  backdrop?: boolean
  label?: string
  children?: ReactNode
}

/**
 * Overlay de loading para cobrir cards, tabelas e areas completas.
 */
function LoadingOverlay({
  active = true,
  className = '',
  backdrop = false,
  label = 'Carregando conteudo',
  children = null,
}: ILoadingOverlayProps) {
  if (!active) {
    return null
  }

  return (
    <div
      className={['ui-loading-overlay', backdrop ? 'ui-loading-overlay--backdrop' : '', className]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <LoadingSpinner size="lg" color="primary" label={label} />
      {children ? <span className="ui-loading-overlay__copy">{children}</span> : null}
    </div>
  )
}

export default LoadingOverlay
