function HourlyBarChart({ data }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="bar-chart">
      <div className="bar-chart__plot">
        {data.map((item) => (
          <div key={item.label} className="bar-chart__item">
            <div
              className="bar-chart__bar"
              style={{ height: `${Math.max((item.value / max) * 100, 6)}%` }}
            />
            <strong className="bar-chart__value">{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="bar-chart__labels">
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}

export default HourlyBarChart;
