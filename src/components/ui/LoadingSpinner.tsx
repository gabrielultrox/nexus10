import type { CSSProperties } from 'react'

export type UILoadingSpinnerSize = 'sm' | 'md' | 'lg'
export type UILoadingSpinnerColor = 'inherit' | 'primary' | 'secondary'

export interface ILoadingSpinnerProps {
  className?: string
  size?: UILoadingSpinnerSize
  color?: UILoadingSpinnerColor
  label?: string
}

/**
 * Spinner SVG leve para estados de carregamento inline ou em overlay.
 */
function LoadingSpinner({
  className = '',
  size = 'md',
  color = 'inherit',
  label = 'Carregando',
}: ILoadingSpinnerProps) {
  return (
    <span
      className={[
        'ui-loading-spinner',
        `ui-loading-spinner--${size}`,
        `ui-loading-spinner--${color}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-label={label}
    >
      <svg className="motion-spinner" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="ui-loading-spinner__track" cx="12" cy="12" r="9" />
        <path className="ui-loading-spinner__indicator" d="M21 12a9 9 0 0 0-9-9" />
      </svg>
      <span className="ui-sr-only">{label}</span>
    </span>
  )
}

export function getLoadingSpinnerSize(size: UILoadingSpinnerSize): CSSProperties['width'] {
  if (size === 'sm') {
    return '14px'
  }

  if (size === 'lg') {
    return '28px'
  }

  return '20px'
}

export default LoadingSpinner
