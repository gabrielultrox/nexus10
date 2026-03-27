function TrashIcon({ className = '', title = 'Excluir' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      title={title}
    >
      <path d="M6 2h4l.5 1H13v1H3V3h2.5L6 2Zm-1 4h1v6H5V6Zm3 0h1v6H8V6Zm3 0h-1v6h1V6Z" />
    </svg>
  )
}

export default TrashIcon
