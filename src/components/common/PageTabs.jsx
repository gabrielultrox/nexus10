function PageTabs({ tabs, activeTab, onTabChange }) {
  return (
    <nav className="page-tabs" aria-label="Navegacao de secoes">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`page-tabs__tab${activeTab === tab.id ? ' page-tabs__tab--active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

export default PageTabs
