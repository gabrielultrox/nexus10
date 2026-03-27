import type { CSSProperties } from 'react'

export type UISkeletonVariant = 'line' | 'rect' | 'circle'

export interface ISkeletonProps {
  className?: string
  width?: CSSProperties['width']
  height?: CSSProperties['height']
  lines?: number
  variant?: UISkeletonVariant
  pulse?: boolean
}

/**
 * Placeholder de loading reutilizavel para tabelas, cards e formularios.
 */
function Skeleton({
  className = '',
  width,
  height,
  lines = 1,
  variant = 'line',
  pulse = true,
}: ISkeletonProps) {
  const baseClassName = [
    'ui-skeleton',
    `ui-skeleton--${variant}`,
    pulse ? 'motion-pulse' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const resolvedHeight =
    height ?? (variant === 'line' ? '12px' : variant === 'circle' ? '40px' : '72px')

  if (lines > 1) {
    return (
      <div className="ui-skeleton-stack" aria-hidden="true">
        {Array.from({ length: lines }).map((_, index) => (
          <span
            key={index}
            className={baseClassName}
            style={{
              width: width ?? '100%',
              height: resolvedHeight,
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <span
      className={baseClassName}
      style={{
        width: width ?? '100%',
        height: resolvedHeight,
      }}
      aria-hidden="true"
    />
  )
}

export default Skeleton
