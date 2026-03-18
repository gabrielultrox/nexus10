import { useState } from 'react';

function HourlyBarChart({ data }) {
  const [activeLabel, setActiveLabel] = useState(null);
  const max = Math.max(...data.map((item) => item.value), 1);
  const activeItem = data.find((item) => item.label === activeLabel) ?? null;

  return (
    <div className="bar-chart">
      <div className="bar-chart__frame">
        {activeItem ? (
          <div className="dashboard-chart-tooltip dashboard-chart-tooltip--top-right">
            <span className="dashboard-chart-tooltip__label">{activeItem.label}</span>
            <strong className="dashboard-chart-tooltip__value">{activeItem.value}</strong>
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
                style={{ height: `${Math.max((item.value / max) * 100, 6)}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      <div
        className="bar-chart__axis"
        style={{ '--chart-columns': data.length }}
      >
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}

export default HourlyBarChart;
