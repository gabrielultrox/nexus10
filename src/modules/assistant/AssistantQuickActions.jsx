function AssistantQuickActions({ actions, onAction }) {
  return (
    <div className="assistant-quick-actions">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className="assistant-quick-actions__item"
          onClick={() => onAction(action)}
        >
          <span className="assistant-quick-actions__eyebrow">Atalho</span>
          <strong>{action.label}</strong>
        </button>
      ))}
    </div>
  )
}

export default AssistantQuickActions
