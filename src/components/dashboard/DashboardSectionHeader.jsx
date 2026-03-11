function DashboardSectionHeader({ eyebrow, title, description }) {
  return (
    <header className="dashboard-section-header">
      <p className="text-overline">{eyebrow}</p>
      <div className="dashboard-section-header__content">
        <div>
          <h2 className="text-section-title">{title}</h2>
          <p className="text-body dashboard-section-header__description">{description}</p>
        </div>
      </div>
    </header>
  );
}

export default DashboardSectionHeader;
