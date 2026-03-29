import { useMemo, useState } from 'react'

import SurfaceCard from '../common/SurfaceCard'

function LineChart({ data = [], valuePrefix = '' }) {
  const [activeIndex, setActiveIndex] = useState(null)
  const gradientId = useMemo(() => `analytics-line-${Math.random().toString(36).slice(2, 10)}`, [])
  const max = Math.max(...data.map((item) => Number(item.value ?? 0)), 1)
  const coordinates = data.map((item, index) => ({
    ...item,
    x: (index / Math.max(data.length - 1, 1)) * 100,
    y: 100 - (Number(item.value ?? 0) / max) * 100,
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
              key={`${item.label}-${index}`}
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
            <strong className="dashboard-chart-tooltip__value">
              {valuePrefix}
              {activeItem.value}
            </strong>
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

function BarChart({ data = [], valuePrefix = '' }) {
  const [activeLabel, setActiveLabel] = useState(null)
  const max = Math.max(...data.map((item) => Number(item.value ?? 0)), 1)
  const activeItem = data.find((item) => item.label === activeLabel) ?? null

  return (
    <div className="bar-chart">
      <div className="bar-chart__frame">
        {activeItem ? (
          <div className="dashboard-chart-tooltip dashboard-chart-tooltip--top-right">
            <span className="dashboard-chart-tooltip__label">{activeItem.label}</span>
            <strong className="dashboard-chart-tooltip__value">
              {valuePrefix}
              {activeItem.value}
            </strong>
          </div>
        ) : null}

        <div className="bar-chart__plot">
          {data.map((item) => (
            <div
              key={item.label}
              className="bar-chart__item"
              onMouseEnter={() => setActiveLabel(item.label)}
              onMouseLeave={() => setActiveLabel(null)}
            >
              <div
                className="bar-chart__bar"
                style={{ height: `${Math.max((Number(item.value ?? 0) / max) * 100, 6)}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bar-chart__axis" style={{ '--chart-columns': data.length }}>
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </div>
  )
}

function PieChart({ data = [], valuePrefix = '' }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const total = data.reduce((sum, item) => sum + Number(item.value ?? 0), 0)
  let currentAngle = -90
  const segments = data.map((item, index) => {
    const value = Number(item.value ?? 0)
    const percentage = total > 0 ? value / total : 0
    const nextAngle = currentAngle + percentage * 360
    const segment = {
      ...item,
      index,
      startAngle: currentAngle,
      endAngle: nextAngle,
    }
    currentAngle = nextAngle
    return segment
  })
  const activeItem = segments[activeIndex] ?? null

  function buildArcPath(startAngle, endAngle) {
    const startRadians = (Math.PI / 180) * startAngle
    const endRadians = (Math.PI / 180) * endAngle
    const radius = 42
    const x1 = 50 + radius * Math.cos(startRadians)
    const y1 = 50 + radius * Math.sin(startRadians)
    const x2 = 50 + radius * Math.cos(endRadians)
    const y2 = 50 + radius * Math.sin(endRadians)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0
    return `M 50 50 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
  }

  return (
    <div className="dashboard-pie-chart">
      <div className="dashboard-pie-chart__visual">
        <svg viewBox="0 0 100 100" className="dashboard-pie-chart__svg" aria-hidden="true">
          {segments.map((item, index) => (
            <path
              key={`${item.label}-${index}`}
              d={buildArcPath(item.startAngle, item.endAngle)}
              className={`dashboard-pie-chart__slice dashboard-pie-chart__slice--${index % 6}`}
              onMouseEnter={() => setActiveIndex(index)}
            />
          ))}
          <circle cx="50" cy="50" r="20" className="dashboard-pie-chart__core" />
        </svg>
        {activeItem ? (
          <div className="dashboard-chart-tooltip dashboard-chart-tooltip--top-right">
            <span className="dashboard-chart-tooltip__label">{activeItem.label}</span>
            <strong className="dashboard-chart-tooltip__value">
              {valuePrefix}
              {activeItem.value}
            </strong>
          </div>
        ) : null}
      </div>

      <div className="dashboard-pie-chart__legend">
        {segments.map((item, index) => (
          <button
            key={`${item.label}-legend`}
            type="button"
            className={`dashboard-pie-chart__legend-item ${
              index === activeIndex ? 'dashboard-pie-chart__legend-item--active' : ''
            }`}
            onMouseEnter={() => setActiveIndex(index)}
            onFocus={() => setActiveIndex(index)}
          >
            <span
              className={`dashboard-pie-chart__swatch dashboard-pie-chart__swatch--${index % 6}`}
            />
            <span className="dashboard-pie-chart__legend-copy">
              <strong>{item.label}</strong>
              <span>
                {valuePrefix}
                {item.value} · {item.share ?? 0}%
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function HeatmapChart({ data = [], valuePrefix = '' }) {
  const [activeKey, setActiveKey] = useState('')
  const max = Math.max(...data.map((item) => Number(item.value ?? 0)), 1)
  const activeItem = data.find((item) => `${item.day}-${item.hour}` === activeKey) ?? null

  return (
    <div className="dashboard-heatmap">
      {activeItem ? (
        <div className="dashboard-chart-tooltip dashboard-chart-tooltip--top-right">
          <span className="dashboard-chart-tooltip__label">
            {activeItem.day} {activeItem.hour}h
          </span>
          <strong className="dashboard-chart-tooltip__value">
            {valuePrefix}
            {activeItem.value}
          </strong>
        </div>
      ) : null}

      <div className="dashboard-heatmap__grid" role="grid" aria-label="Mapa de calor de vendas">
        {data.map((item) => {
          const intensity = Number(item.value ?? 0) / max
          return (
            <button
              key={`${item.day}-${item.hour}`}
              type="button"
              className="dashboard-heatmap__cell"
              style={{ '--heat': intensity }}
              onMouseEnter={() => setActiveKey(`${item.day}-${item.hour}`)}
              onFocus={() => setActiveKey(`${item.day}-${item.hour}`)}
              aria-label={`${item.day} ${item.hour}h: ${valuePrefix}${item.value}`}
            />
          )
        })}
      </div>
      <div className="dashboard-heatmap__labels">
        <span>Dom</span>
        <span>Seg</span>
        <span>Ter</span>
        <span>Qua</span>
        <span>Qui</span>
        <span>Sex</span>
        <span>Sab</span>
      </div>
    </div>
  )
}

function ChartPanel({ chart }) {
  const valuePrefix = chart.valuePrefix ?? ''

  return (
    <SurfaceCard title={chart.title}>
      <div className="dashboard-chart-card dashboard-chart-card--analytics">
        <p className="dashboard-chart-card__description">{chart.description}</p>

        {chart.kind === 'line' ? <LineChart data={chart.data} valuePrefix={valuePrefix} /> : null}
        {chart.kind === 'bar' ? <BarChart data={chart.data} valuePrefix={valuePrefix} /> : null}
        {chart.kind === 'pie' ? <PieChart data={chart.data} valuePrefix={valuePrefix} /> : null}
        {chart.kind === 'heatmap' ? (
          <HeatmapChart data={chart.data} valuePrefix={valuePrefix} />
        ) : null}
      </div>
    </SurfaceCard>
  )
}

export default ChartPanel
