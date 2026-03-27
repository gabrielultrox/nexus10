import type { CSSProperties } from 'react'

interface ISkeletonProps {
  className?: string
  width?: CSSProperties['width']
  height?: CSSProperties['height']
  lines?: number
  circle?: boolean
}

function Skeleton({ className = '', width, height, lines = 1, circle = false }: ISkeletonProps) {
  if (lines > 1) {
    return (
      <div className={['ui-skeleton-stack', className].filter(Boolean).join(' ')}>
        {Array.from({ length: lines }).map((_, index) => (
          <span
            key={index}
            className={`ui-skeleton${circle ? ' ui-skeleton--circle' : ''}`}
            style={{
              width: width ?? '100%',
              height: height ?? '12px',
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <span
      className={['ui-skeleton', circle ? 'ui-skeleton--circle' : '', className]
        .filter(Boolean)
        .join(' ')}
      style={{
        width: width ?? '100%',
        height: height ?? '12px',
      }}
      aria-hidden="true"
    />
  )
}

export default Skeleton
