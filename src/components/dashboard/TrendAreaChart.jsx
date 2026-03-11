function TrendAreaChart({ data }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  const points = data
    .map((item, index) => {
      const x = (index / (data.length - 1 || 1)) * 100;
      const y = 100 - (item.value / max) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `0,100 ${points} 100,100`;

  return (
    <div className="trend-chart">
      <svg viewBox="0 0 100 100" className="trend-chart__svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(51, 217, 255, 0.42)" />
            <stop offset="100%" stopColor="rgba(51, 217, 255, 0.02)" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} className="trend-chart__area" />
        <polyline points={points} className="trend-chart__line" />
      </svg>

      <div className="trend-chart__labels">
        {data.map((item) => (
          <div key={item.label} className="trend-chart__label">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TrendAreaChart;
