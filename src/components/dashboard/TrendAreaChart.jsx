import { useMemo, useState } from 'react'

function TrendAreaChart({ data }) {
  const [activeIndex, setActiveIndex] = useState(null)

  const max = Math.max(...data.map((item) => item.value), 1)
  const gradientId = useMemo(() => `trend-fill-${Math.random().toString(36).slice(2, 10)}`, [])

  const coordinates = data.map((item, index) => ({
    ...item,
    x: (index / (data.length - 1 || 1)) * 100,
    y: 100 - (item.value / max) * 100,
  }))

  const points = coordinates.map((item) => `${item.x},${item.y}`).join(' ')
  const areaPoints = `0,100 ${points} 100,100`
  const activeItem = activeIndex == null ? null : coordinates[activeIndex]

  return (
    <div className="trend-chart">
      <div className="trend-chart__frame">
        <svg viewBox="0 0 100 100" className="trend-chart__svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" className="trend-chart__stop trend-chart__stop--top" />
              <stop offset="100%" className="trend-chart__stop trend-chart__stop--bottom" />
            </linearGradient>
          </defs>
          <polygon
            points={areaPoints}
            className="trend-chart__area"
            style={{ fill: `url(#${gradientId})` }}
          />
          <polyline points={points} className="trend-chart__line" />
          {coordinates.map((item, index) => (
            <circle
              key={item.label}
              cx={item.x}
              cy={item.y}
              r="2"
              className="trend-chart__point"
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            />
          ))}
        </svg>

        {activeItem ? (
          <div
            className="dashboard-chart-tooltip"
            style={{
              left: `${Math.min(Math.max(activeItem.x, 12), 88)}%`,
              top: `${Math.min(Math.max(activeItem.y, 18), 78)}%`,
            }}
          >
            <span className="dashboard-chart-tooltip__label">{activeItem.label}</span>
            <strong className="dashboard-chart-tooltip__value">{activeItem.value}</strong>
          </div>
        ) : null}
      </div>

      <div className="trend-chart__axis" style={{ '--chart-columns': data.length }}>
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </div>
  )
}

export default TrendAreaChart
