const INBOX_ICON = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M2.5 4.5H13.5M4.5 2.5H11.5M3.5 4.5H12.5V12.5C12.5 13.0523 12.0523 13.5 11.5 13.5H4.5C3.94772 13.5 3.5 13.0523 3.5 12.5V4.5Z" />
  </svg>
)

function EmptyState({ message }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">{INBOX_ICON}</span>
      <span className="empty-state__message">{message}</span>
    </div>
  )
}

export default EmptyState
