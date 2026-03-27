function Toast({ message, variant = 'info', visible = true }) {
  return (
    <div
      className={[
        'toast',
        `toast--${variant}`,
        visible ? 'toast--visible' : 'toast--hidden',
        variant === 'error' && visible ? 'motion-shake' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
    >
      <span className="toast__dot" aria-hidden="true" />
      <span className="toast__message">{message}</span>
    </div>
  )
}

export default Toast
